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

    // 1. Lista e ordena chunks
    const { blobs } = await list({ prefix: `chunks/${uploadId}/`, token })
    const totalChunks = blobs.length
    if (!totalChunks)
      return NextResponse.json({ error: 'Nenhum chunk encontrado' }, { status: 400 })

    const sorted = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname))
    console.log(`[finalize] session=${sessionId} chunks=${totalChunks} mime=${mimeType}`)

    // 2. Normaliza MIME
    const safeMime = mimeType.includes('ogg')                          ? 'audio/ogg'
                   : mimeType.includes('wav')                          ? 'audio/wav'
                   : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'audio/mp4'
                   : 'audio/webm'
    const ext = safeMime === 'audio/ogg' ? 'ogg'
              : safeMime === 'audio/wav' ? 'wav'
              : safeMime === 'audio/mp4' ? 'mp4'
              : 'webm'

    await setStatus('transcribing')

    // 3. Baixa e concatena todos os chunks em um único buffer WebM válido
    const buffers: Buffer[] = []
    for (const blob of sorted) {
      buffers.push(await fetchPrivate(blob.url))
    }
    const combined = Buffer.concat(buffers)
    console.log(`[finalize] buffer total=${(combined.byteLength / 1024 / 1024).toFixed(1)} MB`)

    // 4. Transcreve — transcribeAudio já divide em partes de 20MB se necessário
    //    mas como é WebM, só funciona se o arquivo inteiro for válido (< 25MB)
    //    Para gravações longas a 32kbps: 1h = ~14MB, 1h45min = ~24MB — ok
    const WHISPER_MAX = 24 * 1024 * 1024
    let fullText = ''
    let allSegments: TranscriptionSegment[] = []

    if (combined.byteLength <= WHISPER_MAX) {
      // Arquivo inteiro dentro do limite — envia direto
      const result = await transcribeAudio(combined, safeMime, `audio.${ext}`)
      fullText    = result.text
      allSegments = result.segments
    } else {
      // Arquivo grande: divide por número de chunks (cada chunk é WebM válido sozinho)
      // Agrupa chunks originais em lotes de ~20MB
      console.log(`[finalize] arquivo grande — transcrevendo por lotes de chunks`)
      let batchBuffers: Buffer[] = []
      let batchSize = 0
      let timeOffset = 0

      const flush = async () => {
        if (!batchBuffers.length) return
        const batch  = Buffer.concat(batchBuffers)
        const result = await transcribeAudio(batch, safeMime, `audio.${ext}`)
        fullText += (fullText ? ' ' : '') + result.text
        for (const seg of result.segments) {
          allSegments.push({ start: seg.start + timeOffset, end: seg.end + timeOffset, text: seg.text })
        }
        if (result.segments.length > 0)
          timeOffset += result.segments[result.segments.length - 1].end
        batchBuffers = []
        batchSize    = 0
      }

      for (const buf of buffers) {
        if (batchSize + buf.byteLength > WHISPER_MAX) await flush()
        batchBuffers.push(buf)
        batchSize += buf.byteLength
      }
      await flush()
    }

    // 5. Salva transcrição
    await sql`
      update audio_uploads set
        transcription          = ${fullText},
        transcription_segments = ${JSON.stringify(allSegments)},
        storage_path           = null,
        status                 = 'transcribed'
      where upload_id = ${uploadId}
    `
    await sql`update sessions set status = 'processing' where id = ${sessionId}`

    // 6. Deleta chunks
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