// @route apps/web/lib/ai/transcribe.ts
import Groq from 'groq-sdk'
import { WHISPER_PROMPT } from './prompts'
import fs   from 'fs'
import os   from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const groq = new Groq({
  apiKey:     process.env.GROQ_API_KEY,
  timeout:    120_000,
  maxRetries: 0,
})

const WHISPER_MODEL  = 'whisper-large-v3-turbo'
const WHISPER_MAX    = 24 * 1024 * 1024   // 24 MB — limite real do Whisper
const MAX_ATTEMPTS   = 4
const SEGMENT_MINS   = 20                 // cada parte ffmpeg = 20 min

export interface TranscriptionSegment { start: number; end: number; text: string }
export interface TranscriptionResult  { text: string; segments: TranscriptionSegment[] }

// ─── MIME helpers ─────────────────────────────────────────────────────────────

function normalizeMime(mime: string): string {
  if (mime === 'audio/x-m4a' || mime === 'audio/m4a') return 'audio/mp4'
  if (mime === 'audio/mpeg'  || mime === 'audio/mp3')  return 'audio/mpeg'
  return mime
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg':  'ogg',
    'audio/wav':  'wav',
    'audio/mp4':  'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp3':  'mp3',
  }
  return map[mime] ?? 'webm'
}

// ─── ffmpeg split ─────────────────────────────────────────────────────────────

async function splitWithFfmpeg(inputPath: string, ext: string): Promise<string[]> {
  // Tenta encontrar o ffmpeg — usa ffmpeg-static se disponível
  let ffmpegBin = 'ffmpeg'
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ffmpegBin = require('ffmpeg-static') as string
  } catch {}

  const outDir     = os.tmpdir()
  const outPattern = path.join(outDir, `lexie_part_%03d.${ext}`)

  await execFileAsync(ffmpegBin, [
    '-i',        inputPath,
    '-f',        'segment',
    '-segment_time', String(SEGMENT_MINS * 60),
    '-c',        'copy',           // sem re-encode — rápido e preserva qualidade
    '-reset_timestamps', '1',
    '-y',
    outPattern,
  ])

  // Coleta arquivos gerados em ordem
  const parts: string[] = []
  for (let i = 0; ; i++) {
    const p = path.join(outDir, `lexie_part_${String(i).padStart(3, '0')}.${ext}`)
    if (!fs.existsSync(p)) break
    parts.push(p)
  }
  return parts
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType:    string,
  filename =   'audio'
): Promise<TranscriptionResult> {

  const safeMime = normalizeMime(mimeType)
  const ext      = extFromMime(safeMime)

  // Arquivo dentro do limite — envia direto
  if (audioBuffer.byteLength <= WHISPER_MAX) {
    return transcribeChunk(audioBuffer, safeMime, ext, 0)
  }

  // Arquivo grande — divide com ffmpeg por tempo (produz partes válidas)
  console.log(`[transcribe] ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)} MB — dividindo com ffmpeg`)

  const tmpInput = path.join(os.tmpdir(), `lexie_input_${Date.now()}.${ext}`)
  await fs.promises.writeFile(tmpInput, audioBuffer)

  let parts: string[] = []
  try {
    parts = await splitWithFfmpeg(tmpInput, ext)
    console.log(`[transcribe] ${parts.length} partes geradas`)
  } catch (err: any) {
    console.error('[transcribe] ffmpeg falhou:', err.message)
    // Fallback: tenta enviar o arquivo inteiro e deixa o Whisper recusar se for grande demais
    await fs.promises.unlink(tmpInput).catch(() => {})
    return transcribeChunk(audioBuffer, safeMime, ext, 0)
  }

  await fs.promises.unlink(tmpInput).catch(() => {})

  let timeOffset  = 0
  const allTexts:    string[]               = []
  const allSegments: TranscriptionSegment[] = []

  for (let i = 0; i < parts.length; i++) {
    const buf    = await fs.promises.readFile(parts[i])
    const result = await transcribeChunk(buf, safeMime, ext, i)

    allTexts.push(result.text)
    for (const seg of result.segments) {
      allSegments.push({ start: seg.start + timeOffset, end: seg.end + timeOffset, text: seg.text })
    }
    if (result.segments.length > 0) {
      timeOffset += result.segments[result.segments.length - 1].end
    }

    await fs.promises.unlink(parts[i]).catch(() => {})
  }

  return { text: allTexts.join(' '), segments: allSegments }
}

// ─── Transcreve um buffer único ───────────────────────────────────────────────

async function transcribeChunk(
  buffer:  Buffer,
  mime:    string,
  ext:     string,
  part:    number,
  attempt = 0
): Promise<TranscriptionResult> {

  const tmpFile = path.join(os.tmpdir(), `lexie_chunk_${Date.now()}_${part}.${ext}`)

  try {
    console.log(`[transcribe] Parte ${part} tentativa ${attempt + 1}/${MAX_ATTEMPTS} - ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB (${mime})`)

    await fs.promises.writeFile(tmpFile, buffer)
    const stream = fs.createReadStream(tmpFile)

    const res  = await groq.audio.transcriptions.create({
      file:            stream as any,
      model:           WHISPER_MODEL,
      language:        'pt',
      prompt:          WHISPER_PROMPT,
      response_format: 'verbose_json',
    })
    const data = res as any

    const segments: TranscriptionSegment[] = (data.segments ?? []).map((s: any) => ({
      start: Math.round(s.start * 10) / 10,
      end:   Math.round(s.end   * 10) / 10,
      text:  s.text.trim(),
    }))

    return { text: (data.text ?? '').trim(), segments }

  } catch (err: any) {
    if (attempt >= MAX_ATTEMPTS - 1) throw err

    if (err?.status === 429) {
      const waitMs = (attempt + 1) * 60_000
      console.warn(`[transcribe] 429 — aguardando ${waitMs / 1000}s`)
      await sleep(waitMs)
      return transcribeChunk(buffer, mime, ext, part, attempt + 1)
    }

    const retryable = err?.status >= 500
      || err?.message?.includes('timeout')
      || err?.message?.includes('ECONNRESET')

    if (retryable) {
      await sleep((attempt + 1) * 5_000)
      return transcribeChunk(buffer, mime, ext, part, attempt + 1)
    }

    throw err

  } finally {
    fs.promises.unlink(tmpFile).catch(() => {})
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }