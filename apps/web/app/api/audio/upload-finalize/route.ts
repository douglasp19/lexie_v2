// @route apps/web/app/api/audio/upload-finalize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { deleteAudio } from '@/lib/storage/audio'
import { transcribeAudio, TranscriptionSegment } from '@/lib/ai/transcribe'
import { list } from '@vercel/blob'

export const maxDuration = 300

async function fetchPrivate(url: string): Promise<Buffer> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`fetchPrivate: ${res.status} — ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(req: NextRequest) {
  const body      = await req.json()
  const uploadId  = body.uploadId
  const mimeType  = body.mimeType ?? 'audio/webm'
  const sessionId = body.sessionId ?? req.headers.get('x-session-id')

  if (!uploadId || !sessionId)
    return NextResponse.json({ error: 'uploadId e sessionId são obrigatórios' }, { status: 400 })

  const setStatus = (status: string) =>
    sql`update audio_uploads set status = ${status} where upload_id = ${uploadId}`

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN

    // 1. Lista chunks originais
    const { blobs } = await list({ prefix: `chunks/${uploadId}/`, token })
    const totalChunks = blobs.length
    if (!totalChunks)
      return NextResponse.json({ error: 'Nenhum chunk encontrado' }, { status: 400 })

    const sorted = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname))
    console.log(`[finalize] session=${sessionId} chunks=${totalChunks} mime=${mimeType}`)

    // 2. Normaliza MIME
    const safeMime = mimeType.includes('ogg')               ? 'audio/ogg'
                   : mimeType.includes('wav')               ? 'audio/wav'
                   : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'audio/mp4'
                   : 'audio/webm'

    const ext = safeMime === 'audio/ogg' ? 'ogg'
              : safeMime === 'audio/wav' ? 'wav'
              : safeMime === 'audio/mp4' ? 'mp4'
              : 'webm'

    await setStatus('transcribing')
    await sql`
      update audio_uploads set storage_path = ${'chunked'}, status = 'transcribing'
      where upload_id = ${uploadId}
    `

    // 3. Transcreve cada chunk individualmente — cada um é um WebM válido
    //    Agrupa chunks em lotes de ~18 MB para reduzir chamadas à API
    const MAX_BATCH = 18 * 1024 * 1024
    let timeOffset  = 0
    const allTexts: string[]              = []
    const allSegments: TranscriptionSegment[] = []

    let batchBuffers: Buffer[] = []
    let batchSize   = 0

    async function flushBatch() {
      if (batchBuffers.length === 0) return
      const combined = Buffer.concat(batchBuffers)
      console.log(`[finalize] transcrevendo lote ${(combined.byteLength / 1024 / 1024).toFixed(1)} MB`)
      const result = await transcribeAudio(combined, safeMime, `audio.${ext}`)
      allTexts.push(result.text)
      for (const seg of result.segments) {
        allSegments.push({ start: seg.start + timeOffset, end: seg.end + timeOffset, text: seg.text })
      }
      if (result.segments.length > 0) {
        timeOffset += result.segments[result.segments.length - 1].end
      }
      batchBuffers = []
      batchSize    = 0
    }

    for (const blob of sorted) {
      const buf = await fetchPrivate(blob.url)
      if (batchSize + buf.byteLength > MAX_BATCH) {
        await flushBatch()
      }
      batchBuffers.push(buf)
      batchSize += buf.byteLength
    }
    await flushBatch()

    const fullText = allTexts.join(' ')

    // 4. Salva transcrição
    await sql`
      update audio_uploads set
        transcription          = ${fullText},
        transcription_segments = ${JSON.stringify(allSegments)},
        storage_path           = null,
        status                 = 'transcribed'
      where upload_id = ${uploadId}
    `
    await sql`update sessions set status = 'processing' where id = ${sessionId}`

    // 5. Deleta chunks do Blob
    for (const blob of sorted) {
      await deleteAudio(blob.url).catch(() => {})
    }

    console.log(`[finalize] ✅ chars=${fullText.length} segments=${allSegments.length}`)
    return NextResponse.json({ ok: true, transcriptionLength: fullText.length })

  } catch (err: any) {
    await setStatus('error').catch(() => {})
    console.error('[finalize] ❌', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Erro desconhecido' }, { status: 500 })
  }
}