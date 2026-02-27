// @route apps/web/lib/storage/audio.ts
import { put, del, list } from '@vercel/blob'

const CHUNK_PATH = (uploadId: string, i: number) =>
  `chunks/${uploadId}/chunk_${String(i).padStart(5, '0')}`

// ─── Fetch autenticado para store privado ─────────────────────────────────────

async function fetchPrivate(url: string): Promise<Response> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`fetchPrivate: ${res.status} — ${url}`)
  return res
}

// ─── Upload de chunk individual ───────────────────────────────────────────────

export async function uploadChunk(
  uploadId:   string,
  chunkIndex: number,
  data:       Buffer
): Promise<void> {
  await put(CHUNK_PATH(uploadId, chunkIndex), data, {
    access:          'private',
    contentType:     'application/octet-stream',
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

  const token = process.env.BLOB_READ_WRITE_TOKEN
  const { blobs } = await list({ prefix: `chunks/${uploadId}/`, token })

  if (blobs.length !== totalChunks)
    throw new Error(`assembleChunks: esperado ${totalChunks} chunks, encontrado ${blobs.length}`)

  const sorted = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname))

  const buffers: Buffer[] = []
  for (const blob of sorted) {
    const res = await fetchPrivate(blob.url)
    buffers.push(Buffer.from(await res.arrayBuffer()))
  }

  const combined = Buffer.concat(buffers)
  const ext      = mimeType.includes('ogg') ? 'ogg'
                 : mimeType.includes('wav') ? 'wav'
                 : mimeType.includes('mp4') ? 'mp4'
                 : 'webm'

  const finalPath = `sessions/${sessionId}/${uploadId}.${ext}`

  const final = await put(finalPath, combined, {
    access:          'private',
    contentType:     mimeType,
    addRandomSuffix: false,
  })

  await del(sorted.map(b => b.url)).catch(() => {})

  return final.url
}

// ─── Download para transcrição ────────────────────────────────────────────────

export async function downloadAudio(storageUrl: string): Promise<Buffer> {
  const res = await fetchPrivate(storageUrl)
  return Buffer.from(await res.arrayBuffer())
}

// ─── Deletar arquivo de áudio ─────────────────────────────────────────────────

export async function deleteAudio(storageUrl: string): Promise<void> {
  await del(storageUrl)
}