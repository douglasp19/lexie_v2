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

function normalizeMime(raw: string): string {
  if (raw.includes('mpeg') || raw.includes('mp3'))           return 'audio/mpeg'
  if (raw.includes('mp4') || raw.includes('m4a'))            return 'audio/mp4'
  if (raw.includes('ogg'))                                   return 'audio/ogg'
  if (raw.includes('wav'))                                   return 'audio/wav'
  if (raw.includes('webm'))                                  return 'audio/webm'
  return 'audio/webm'
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
    if (!blobs.length)
      return NextResponse.json({ error: 'Nenhum chunk encontrado' }, { status: 400 })

    const sorted = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname))
    const safeMime = normalizeMime(mimeType)
    console.log(`[finalize] session=${sessionId} chunks=${sorted.length} mime=${safeMime}`)

    await setStatus('transcribing')

    // 2. Baixa e concatena todos os chunks
    const buffers: Buffer[] = []
    for (const blob of sorted) {
      buffers.push(await fetchPrivate(blob.url))
    }
    const combined = Buffer.concat(buffers)
    console.log(`[finalize] buffer total=${(combined.byteLength / 1024 / 1024).toFixed(1)} MB`)

    // 3. Transcreve — transcribeAudio usa ffmpeg para dividir arquivos > 24 MB por tempo
    const result = await transcribeAudio(combined, safeMime)
    const { text: fullText, segments: allSegments } = result

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
    // 429 = rate limit — não marca como erro permanente, deixa o usuário tentar de novo
    if (err?.status === 429) {
      await setStatus('error').catch(() => {})
      console.warn('[finalize] 429 rate limit:', err.message)
      return NextResponse.json(
        { error: 'Limite de transcrição atingido. Aguarde alguns minutos e tente novamente.' },
        { status: 429 }
      )
    }

    await setStatus('error').catch(() => {})
    console.error('[finalize] ❌', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Erro desconhecido' }, { status: 500 })
  }
}