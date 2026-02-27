// @route apps/web/lib/ai/transcribe.ts
import Groq from 'groq-sdk'
import { WHISPER_PROMPT } from './prompts'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: 120_000,
  maxRetries: 0,
})

const WHISPER_MODEL = 'whisper-large-v3-turbo'
const MAX_BYTES = 20 * 1024 * 1024
const MAX_ATTEMPTS = 4

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename = 'audio.webm'
): Promise<TranscriptionResult> {

  if (audioBuffer.byteLength <= MAX_BYTES) {
    return transcribeChunk(audioBuffer, mimeType, filename, 0)
  }

  const totalMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(1)
  const parts = Math.ceil(audioBuffer.byteLength / MAX_BYTES)
  console.log(`[transcribe] ${totalMB} MB -> ${parts} partes`)

  let timeOffset = 0
  const allSegments: TranscriptionSegment[] = []
  const allTexts: string[] = []

  for (let i = 0; i < parts; i++) {
    const chunk = audioBuffer.subarray(i * MAX_BYTES, (i + 1) * MAX_BYTES)
    const result = await transcribeChunk(chunk, mimeType, filename, i)

    allTexts.push(result.text)

    for (const seg of result.segments) {
      allSegments.push({
        start: seg.start + timeOffset,
        end: seg.end + timeOffset,
        text: seg.text,
      })
    }

    if (result.segments.length > 0) {
      timeOffset = result.segments[result.segments.length - 1].end + timeOffset
    }
  }

  return { text: allTexts.join(' '), segments: allSegments }
}

async function transcribeChunk(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  part: number,
  attempt = 0
): Promise<TranscriptionResult> {
  try {
    console.log(`[transcribe] Parte ${part} tentativa ${attempt + 1}/${MAX_ATTEMPTS} - ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`)

    const uint8 = new Uint8Array(buffer)

    const file = new File([uint8], filename, { type: mimeType })
    
    const res = await groq.audio.transcriptions.create({
      file,
      model: WHISPER_MODEL,
      language: 'pt',
      prompt: WHISPER_PROMPT,
      response_format: 'verbose_json',
    })

    const data = res as any

    const segments: TranscriptionSegment[] = (data.segments ?? []).map((s: any) => ({
      start: Math.round(s.start * 10) / 10,
      end: Math.round(s.end * 10) / 10,
      text: s.text.trim(),
    }))

    return { text: (data.text ?? '').trim(), segments }

  } catch (err: any) {
    if (attempt >= MAX_ATTEMPTS - 1) throw err

    if (err?.status === 429) {
      const waitMs = parseGroqWaitTime(err?.message) ?? (60_000 * (attempt + 1))
      console.warn(`[transcribe] Rate limit 429 - aguardando ${Math.ceil(waitMs / 1000)}s...`)
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
      console.log(`[transcribe] Erro ${err?.status ?? 'rede'} - retry em ${delay / 1000}s...`)
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
  const hours = raw.match(/(\d+)h/)
  const minutes = raw.match(/(\d+)m/)
  const seconds = raw.match(/([\d.]+)s/)
  if (hours) ms += parseInt(hours[1]) * 3_600_000
  if (minutes) ms += parseInt(minutes[1]) * 60_000
  if (seconds) ms += parseFloat(seconds[1]) * 1_000
  return ms > 0 ? ms + 3_000 : null
}