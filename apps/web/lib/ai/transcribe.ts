// @route apps/web/lib/ai/transcribe.ts
import Groq from 'groq-sdk'
import { WHISPER_PROMPT } from './prompts'
import fs from 'fs'
import os from 'os'
import path from 'path'

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

/**
 * Whisper NÃO aceita audio/x-m4a
 */
function normalizeMime(mime: string): string {
  if (mime === 'audio/x-m4a' || mime === 'audio/m4a') return 'audio/mp4'
  if (mime === 'audio/webm') return 'audio/webm'
  if (mime === 'audio/ogg') return 'audio/ogg'
  if (mime === 'audio/wav') return 'audio/wav'
  return mime
}

function extFromMime(mime: string): string {
  if (mime === 'audio/mp4') return 'mp4'
  if (mime === 'audio/webm') return 'webm'
  if (mime === 'audio/ogg') return 'ogg'
  if (mime === 'audio/wav') return 'wav'
  return 'bin'
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename = 'audio'
): Promise<TranscriptionResult> {

  const safeMime = normalizeMime(mimeType)

  if (audioBuffer.byteLength <= MAX_BYTES) {
    return transcribeChunk(audioBuffer, safeMime, filename, 0)
  }

  const parts = Math.ceil(audioBuffer.byteLength / MAX_BYTES)
  console.log(`[transcribe] ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)} MB -> ${parts} partes`)

  let timeOffset = 0
  const allSegments: TranscriptionSegment[] = []
  const allTexts: string[] = []

  for (let i = 0; i < parts; i++) {
    const chunk = audioBuffer.subarray(i * MAX_BYTES, (i + 1) * MAX_BYTES)
    const result = await transcribeChunk(chunk, safeMime, filename, i)

    allTexts.push(result.text)

    for (const seg of result.segments) {
      allSegments.push({
        start: seg.start + timeOffset,
        end: seg.end + timeOffset,
        text: seg.text,
      })
    }

    if (result.segments.length > 0) {
      timeOffset += result.segments[result.segments.length - 1].end
    }
  }

  return { text: allTexts.join(' '), segments: allSegments }
}

async function transcribeChunk(
  buffer: Buffer,
  mimeType: string,
  baseName: string,
  part: number,
  attempt = 0
): Promise<TranscriptionResult> {
  const ext = extFromMime(mimeType)
  const tmpFile = path.join(os.tmpdir(), `${baseName}-${part}.${ext}`)

  try {
    console.log(
      `[transcribe] Parte ${part} tentativa ${attempt + 1}/${MAX_ATTEMPTS} - ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB (${mimeType})`
    )

    // ✅ grava arquivo temporário REAL
    await fs.promises.writeFile(tmpFile, buffer)

    const stream = fs.createReadStream(tmpFile)

    const res = await groq.audio.transcriptions.create({
      file: stream as any,
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

    return {
      text: (data.text ?? '').trim(),
      segments,
    }

  } catch (err: any) {
    if (attempt >= MAX_ATTEMPTS - 1) throw err

    if (err?.status === 429) {
      const waitMs = (attempt + 1) * 60_000
      console.warn(`[transcribe] 429 - aguardando ${waitMs / 1000}s`)
      await sleep(waitMs)
      return transcribeChunk(buffer, mimeType, baseName, part, attempt + 1)
    }

    const retryable =
      err?.status >= 500 ||
      err?.message?.includes('timeout') ||
      err?.message?.includes('ECONNRESET')

    if (retryable) {
      const delay = (attempt + 1) * 5_000
      await sleep(delay)
      return transcribeChunk(buffer, mimeType, baseName, part, attempt + 1)
    }

    throw err
  } finally {
    // 🧹 limpeza garantida
    fs.promises.unlink(tmpFile).catch(() => {})
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}