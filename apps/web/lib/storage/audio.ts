// @route apps/web/lib/storage/audio.ts
// npm install @vercel/blob
import { put, del, list, download } from '@vercel/blob'

// ─── Upload de chunk individual ───────────────────────────────────────────────

export async function uploadChunk(
  uploadId:   string,
  chunkIndex: number,
  data:       Buffer
): Promise<void> {
  const path = `chunks/${uploadId}/chunk_${String(chunkIndex).padStart(5, '0')}`

  await put(path, data, {
    access:          'private',
    contentType:     'audio/webm',
    addRandomSuffix: false,
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
  const { blobs } = await list({ prefix: `chunks/${uploadId}/`, mode: 'folded' })

  // folded retorna a pasta — usa expanded para pegar os arquivos
  const { blobs: files } = await list({ prefix: `chunks/${uploadId}/` })

  if (files.length !== totalChunks) {
    throw new Error(`assembleChunks: esperado ${totalChunks} chunks, encontrado ${files.length}`)
  }

  // Ordena pelo pathname (chunk_00000, chunk_00001, ...)
  const sorted = files.sort((a, b) => a.pathname.localeCompare(b.pathname))

  // Baixa cada chunk usando o SDK (suporta store privado)
  const buffers: Buffer[] = []
  for (const blob of sorted) {
    const res = await download(blob.url)
    if (!res.ok) throw new Error(`assembleChunks: download falhou para ${blob.pathname} (${res.status})`)
    buffers.push(Buffer.from(await res.arrayBuffer()))
  }

  const combined  = Buffer.concat(buffers)
  const ext       = mimeType.includes('ogg') ? 'ogg' : 'webm'
  const finalPath = `sessions/${sessionId}/${uploadId}.${ext}`
  const safeMime  = mimeType.includes('ogg') ? 'audio/ogg' : 'audio/webm'

  // Upload do arquivo montado
  const final = await put(finalPath, combined, {
    access:          'private',
    contentType:     safeMime,
    addRandomSuffix: false,
  })

  // Remove chunks temporários (best-effort)
  await del(sorted.map(b => b.url)).catch(() => {})

  return final.url
}

// ─── Download para transcrição ────────────────────────────────────────────────

export async function downloadAudio(storagePath: string): Promise<Buffer> {
  // Usa o SDK para download autenticado (store privado)
  const res = await download(storagePath)
  if (!res.ok) throw new Error(`downloadAudio: ${res.status} — ${storagePath}`)
  return Buffer.from(await res.arrayBuffer())
}

// ─── Deletar arquivo de áudio ─────────────────────────────────────────────────

export async function deleteAudio(storagePath: string): Promise<void> {
  await del(storagePath)
}