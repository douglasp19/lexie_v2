// @route apps/web/lib/ai/transcribe.ts
import Groq from 'groq-sdk'
import { WHISPER_PROMPT } from './prompts'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, readFile, unlink } from 'fs/promises'
import crypto from 'crypto'

// Aponta o ffmpeg para o binário estático (sem precisar instalar no SO)
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic)

const groq = new Groq({
  apiKey:     process.env.GROQ_API_KEY,
  timeout:    120_000,
  maxRetries: 0,
})

const WHISPER_MODEL = 'whisper-large-v3-turbo'
const GROQ_LIMIT    = 24 * 1024 * 1024
const MAX_ATTEMPTS  = 4

const NO_CHUNK_FORMATS = [
  'wav', 'wave', 'x-wav',
  'mp3', 'mpeg',
  'mp4', 'm4a', 'aac',
  'flac', 'x-flac',
]

function isChunkSafe(mimeType: string): boolean {
  const sub = mimeType.toLowerCase().split('/')[1] ?? ''
  return !NO_CHUNK_FORMATS.some(f => sub.includes(f))
}

async function convertToWebm(inputBuffer: Buffer, inputExt: string): Promise<Buffer> {
  const id      = crypto.randomUUID()
  const inPath  = join(tmpdir(), `lexie_in_${id}.${inputExt}`)
  const outPath = join(tmpdir(), `lexie_out_${id}.webm`)

  await writeFile(inPath, inputBuffer)
  console.log(`[transcribe] Convertendo ${inputExt} -> webm via ffmpeg...`)

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inPath)
      .audioCodec('libopus')
      .audioBitrate('64k')
      .format('webm')
      .on('end',   resolve)
      .on('error', reject)
      .save(outPath)
  })

  const converted = await readFile(outPath)
  await Promise.all([unlink(inPath), unlink(outPath)]).catch(() => {})

  const inMB  = (inputBuffer.byteLength / 1024 / 1024).toFixed(1)
  const outMB = (converted.byteLength  / 1024 / 1024).toFixed(1)
  console.log(`[transcribe] Conversao concluida: ${inMB} MB -> ${outMB} MB`)

  return converted
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename = 'audio.webm'
): Promise<string> {

  const totalMB    = (audioBuffer.byteLength / 1024 / 1024).toFixed(1)
  const needsChunk = audioBuffer.byteLength > GROQ_LIMIT

  if (!needsChunk) {
    console.log(`[transcribe] ${totalMB} MB -- enviando direto (${mimeType})`)
    return transcribeChunk(audioBuffer, mimeType, filename, 0)
  }

  if (!isChunkSafe(mimeType)) {
    const ext   = filename.split('.').pop() ?? mimeType.split('/')[1] ?? 'audio'
    audioBuffer = await convertToWebm(audioBuffer, ext)
    mimeType    = 'audio/webm'
    filename    = filename.replace(/\.[^.]+$/, '.webm')
  }

  const parts = Math.ceil(audioBuffer.byteLength / GROQ_LIMIT)
  console.log(`[transcribe] ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)} MB -> ${parts} partes`)

  const results: string[] = []
  for (let i = 0; i < parts; i++) {
    const chunk = audioBuffer.subarray(i * GROQ_LIMIT, (i + 1) * GROQ_LIMIT)
    const text  = await transcribeChunk(chunk, mimeType, filename, i)
    if (text) results.push(text)
  }

  return results.join(' ')
}

async function transcribeChunk(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  part: number,
  attempt = 0
): Promise<string> {
  try {
    console.log(
      `[transcribe] Parte ${part} tentativa ${attempt + 1}/${MAX_ATTEMPTS} -- ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`
    )

    const file = new File([buffer], filename, { type: mimeType })
    const res  = await groq.audio.transcriptions.create({
      file,
      model:           WHISPER_MODEL,
      language:        'pt',
      prompt:          WHISPER_PROMPT,
      response_format: 'text',
    })

    return (res as unknown as string).trim()

  } catch (err: any) {
    if (attempt >= MAX_ATTEMPTS - 1) throw err

    if (err?.status === 429) {
      const waitMs  = parseGroqWaitTime(err?.message) ?? (60_000 * (attempt + 1))
      const waitSec = Math.ceil(waitMs / 1000)
      console.warn(`[transcribe] Rate limit (429) -- aguardando ${waitSec}s...`)
      await sleep(waitMs)
      return transcribeChunk(buffer, mimeType, filename, part, attempt + 1)
    }

    const isRetryable =
      err?.status >= 500 ||
      err?.message?.includes('Connection') ||
      err?.message?.includes('timeout') ||
      err?.message?.includes('ECONNRESET')

    if (isRetryable) {
      const delay = (attempt + 1) * 5_000
      console.log(`[transcribe] Erro ${err?.status ?? 'rede'} -- retry em ${delay / 1000}s...`)
      await sleep(delay)
      return transcribeChunk(buffer, mimeType, filename, part, attempt + 1)
    }

    throw err
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseGroqWaitTime(message?: string): number | null {
  if (!message) return null

  const match = message.match(/try again in\s+((?:\d+h)?\s*(?:\d+m)?\s*(?:[\d.]+s)?)/i)
  if (!match) return null

  const raw = match[1]
  let ms = 0

  const hours   = raw.match(/(\d+)h/)
  const minutes = raw.match(/(\d+)m/)
  const seconds = raw.match(/([\d.]+)s/)

  if (hours)   ms += parseInt(hours[1])   * 3_600_000
  if (minutes) ms += parseInt(minutes[1]) * 60_000
  if (seconds) ms += parseFloat(seconds[1]) * 1_000

  return ms > 0 ? ms + 3_000 : null
}