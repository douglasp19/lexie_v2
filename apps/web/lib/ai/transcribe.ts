// @route apps/web/lib/ai/transcribe.ts
import Groq from 'groq-sdk'
import { WHISPER_PROMPT } from './prompts'

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY,
  timeout: 120_000, // 2 min por chunk
  maxRetries: 3,
})

const WHISPER_MODEL = 'whisper-large-v3-turbo'
const MAX_BYTES     = 20 * 1024 * 1024  // 20 MB — margem generosa

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename = 'audio.webm'
): Promise<string> {

  // Arquivo pequeno — envia direto
  if (audioBuffer.byteLength <= MAX_BYTES) {
    return transcribeChunk(audioBuffer, mimeType, filename, 0)
  }

  // Arquivo grande — divide em partes de 20 MB
  const totalMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(1)
  const parts   = Math.ceil(audioBuffer.byteLength / MAX_BYTES)
  console.log(`[transcribe] ${totalMB} MB → ${parts} partes`)

  const results: string[] = []
  for (let i = 0; i < parts; i++) {
    const chunk = audioBuffer.subarray(i * MAX_BYTES, (i + 1) * MAX_BYTES)
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
    console.log(`[transcribe] Parte ${part} tentativa ${attempt + 1} — ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`)
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
    // Retry em connection error (até 3x com backoff)
    if (attempt < 2 && (err.message?.includes('Connection') || err.message?.includes('timeout') || err.status >= 500)) {
      const delay = (attempt + 1) * 5000
      console.log(`[transcribe] Retry em ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
      return transcribeChunk(buffer, mimeType, filename, part, attempt + 1)
    }
    throw err
  }
}