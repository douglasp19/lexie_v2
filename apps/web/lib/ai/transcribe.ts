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

const WHISPER_MODEL = 'whisper-large-v3-turbo'
const WHISPER_MAX   = 24 * 1024 * 1024   // 24 MB
const MAX_ATTEMPTS  = 3
const SEGMENT_MINS  = 20                 // partes de 20 min ao dividir com ffmpeg

export interface TranscriptionSegment { start: number; end: number; text: string }
export interface TranscriptionResult  { text: string; segments: TranscriptionSegment[] }

// ─── MIME helpers ─────────────────────────────────────────────────────────────

function extFromMime(mime: string): string {
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3'
  if (mime === 'audio/mp4')                          return 'mp4'
  if (mime === 'audio/ogg')                          return 'ogg'
  if (mime === 'audio/wav')                          return 'wav'
  return 'webm'
}

// ─── ffmpeg split por tempo ───────────────────────────────────────────────────

async function splitWithFfmpeg(inputPath: string, ext: string): Promise<string[]> {
  let ffmpegBin = 'ffmpeg'
  try { ffmpegBin = require('ffmpeg-static') as string } catch {}

  const outDir     = os.tmpdir()
  const tag        = Date.now()
  const outPattern = path.join(outDir, `lexie_${tag}_part_%03d.${ext}`)

  await execFileAsync(ffmpegBin, [
    '-i', inputPath,
    '-f', 'segment',
    '-segment_time', String(SEGMENT_MINS * 60),
    '-c', 'copy',
    '-reset_timestamps', '1',
    '-y',
    outPattern,
  ])

  const parts: string[] = []
  for (let i = 0; ; i++) {
    const p = path.join(outDir, `lexie_${tag}_part_${String(i).padStart(3, '0')}.${ext}`)
    if (!fs.existsSync(p)) break
    parts.push(p)
  }
  return parts
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType:    string,
): Promise<TranscriptionResult> {

  const ext = extFromMime(mimeType)

  if (audioBuffer.byteLength <= WHISPER_MAX) {
    return transcribeChunk(audioBuffer, mimeType, ext, 0)
  }

  // Arquivo > 24 MB — divide com ffmpeg por tempo
  console.log(`[transcribe] ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)} MB — dividindo com ffmpeg (${SEGMENT_MINS} min/parte)`)

  const tmpInput = path.join(os.tmpdir(), `lexie_input_${Date.now()}.${ext}`)
  await fs.promises.writeFile(tmpInput, audioBuffer)

  let parts: string[] = []
  try {
    parts = await splitWithFfmpeg(tmpInput, ext)
    console.log(`[transcribe] ${parts.length} partes geradas pelo ffmpeg`)
  } catch (err: any) {
    await fs.promises.unlink(tmpInput).catch(() => {})
    console.error('[transcribe] ffmpeg falhou:', err.message)
    // Tenta enviar o arquivo inteiro — o Whisper vai rejeitar se for > 25 MB
    return transcribeChunk(audioBuffer, mimeType, ext, 0)
  }

  await fs.promises.unlink(tmpInput).catch(() => {})

  let timeOffset  = 0
  const allTexts:    string[]               = []
  const allSegments: TranscriptionSegment[] = []

  for (let i = 0; i < parts.length; i++) {
    const buf    = await fs.promises.readFile(parts[i])
    const result = await transcribeChunk(buf, mimeType, ext, i)

    allTexts.push(result.text)
    for (const seg of result.segments) {
      allSegments.push({
        start: seg.start + timeOffset,
        end:   seg.end   + timeOffset,
        text:  seg.text,
      })
    }
    if (result.segments.length > 0)
      timeOffset += result.segments[result.segments.length - 1].end

    await fs.promises.unlink(parts[i]).catch(() => {})
  }

  return { text: allTexts.join(' '), segments: allSegments }
}

// ─── Transcreve um buffer ─────────────────────────────────────────────────────

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
    // 400 = arquivo inválido — NÃO faz retry, só desperdiça cota
    if (err?.status === 400) throw err

    // 429 = rate limit — propaga imediatamente, sem retry
    if (err?.status === 429) throw err

    if (attempt >= MAX_ATTEMPTS - 1) throw err

    if (err?.status >= 500
      || err?.message?.includes('timeout')
      || err?.message?.includes('ECONNRESET')) {
      await sleep((attempt + 1) * 5_000)
      return transcribeChunk(buffer, mime, ext, part, attempt + 1)
    }

    throw err

  } finally {
    fs.promises.unlink(tmpFile).catch(() => {})
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }