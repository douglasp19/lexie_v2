// @route apps/web/lib/storage/audio.ts
import { supabase } from '../db/client'

const BUCKET = 'audio-temp'

// ─── Upload de chunk individual ───────────────────────────────────────────────

export async function uploadChunk(
  uploadId: string,
  chunkIndex: number,
  data: Buffer
): Promise<void> {
  const path = `chunks/${uploadId}/chunk_${String(chunkIndex).padStart(5, '0')}`

  // Supabase não aceita application/octet-stream — usa audio/webm para chunks
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, data, { upsert: true, contentType: 'audio/webm' })

  if (error) throw new Error(`uploadChunk[${chunkIndex}]: ${error.message}`)
}

// ─── Montar arquivo final juntando todos os chunks ────────────────────────────

export async function assembleChunks(
  uploadId: string,
  totalChunks: number,
  mimeType: string,
  sessionId: string
): Promise<string> {
  const buffers: Buffer[] = []

  for (let i = 0; i < totalChunks; i++) {
    const path = `chunks/${uploadId}/chunk_${String(i).padStart(5, '0')}`

    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (error) throw new Error(`assembleChunks - download chunk ${i}: ${error.message}`)

    buffers.push(Buffer.from(await (data as Blob).arrayBuffer()))
  }

  const combined  = Buffer.concat(buffers)
  const ext       = mimeType.includes('ogg') ? 'ogg' : 'webm'
  const finalPath = `sessions/${sessionId}/${uploadId}.${ext}`

  // Normaliza mime type para garantir compatibilidade com Supabase
  // Supabase só aceita audio/webm e audio/ogg — normaliza sempre
  const safeMime = mimeType.includes('ogg') ? 'audio/ogg' : 'audio/webm'

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(finalPath, combined, { contentType: safeMime, upsert: true })

  if (upErr) throw new Error(`assembleChunks - upload final: ${upErr.message}`)

  // Limpa chunks temporários (best-effort)
  const paths = Array.from(
    { length: totalChunks },
    (_, i) => `chunks/${uploadId}/chunk_${String(i).padStart(5, '0')}`
  )
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {})

  return finalPath
}

// ─── Download para transcrição ────────────────────────────────────────────────

export async function downloadAudio(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw new Error(`downloadAudio: ${error.message}`)
  return Buffer.from(await (data as Blob).arrayBuffer())
}

// ─── Deletar arquivo de áudio ─────────────────────────────────────────────────

export async function deleteAudio(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw new Error(`deleteAudio: ${error.message}`)
}