// @route apps/web/lib/storage/audio.ts
// npm install @vercel/blob
import { put, del, list } from '@vercel/blob'

// ─── Upload de chunk individual ───────────────────────────────────────────────

export async function uploadChunk(
  uploadId:   string,
  chunkIndex: number,
  data:       Buffer
): Promise<void> {
  const path = `chunks/${uploadId}/chunk_${String(chunkIndex).padStart(5, '0')}`

  await put(path, data, {
    access:          'public',  // único modo disponível no Vercel Blob
    contentType:     'audio/webm',
    addRandomSuffix: false,     // path previsível para poder listar por prefix
  })
}

// ─── Montar arquivo final juntando todos os chunks ────────────────────────────

export async function assembleChunks(
  uploadId:    string,
  totalChunks: number,
  mimeType:    string,
  sessionId:   string
): Promise<string> {

  // Lista todos os chunks deste upload pelo prefix
  const { blobs } = await list({ prefix: `chunks/${uploadId}/` })

  if (blobs.length !== totalChunks) {
    throw new Error(`assembleChunks: esperado ${totalChunks} chunks, encontrado ${blobs.length}`)
  }

  // Ordena pelo nome (chunk_00000, chunk_00001, ...)
  const sorted = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname))

  // Baixa cada chunk e monta o buffer
  const buffers: Buffer[] = []
  for (const blob of sorted) {
    const res = await fetch(blob.url)
    if (!res.ok) throw new Error(`assembleChunks: download falhou para ${blob.pathname} (${res.status})`)
    buffers.push(Buffer.from(await res.arrayBuffer()))
  }

  const combined  = Buffer.concat(buffers)
  const ext       = mimeType.includes('ogg') ? 'ogg' : 'webm'
  const finalPath = `sessions/${sessionId}/${uploadId}.${ext}`
  const safeMime  = mimeType.includes('ogg') ? 'audio/ogg' : 'audio/webm'

  // Upload do arquivo montado
  const final = await put(finalPath, combined, {
    access:          'public',
    contentType:     safeMime,
    addRandomSuffix: false,
  })

  // Remove chunks temporários (best-effort)
  const urlsToDelete = sorted.map(b => b.url)
  await del(urlsToDelete).catch(() => {})

  // Retorna a URL pública (salva como storage_path no banco)
  return final.url
}

// ─── Download para transcrição ────────────────────────────────────────────────

export async function downloadAudio(storagePath: string): Promise<Buffer> {
  // storagePath é a URL pública do Vercel Blob
  const res = await fetch(storagePath)
  if (!res.ok) throw new Error(`downloadAudio: ${res.status} — ${storagePath}`)
  return Buffer.from(await res.arrayBuffer())
}

// ─── Deletar arquivo de áudio ─────────────────────────────────────────────────

export async function deleteAudio(storagePath: string): Promise<void> {
  await del(storagePath)
}