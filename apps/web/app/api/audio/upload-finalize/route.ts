// @route apps/web/app/api/audio/upload-finalize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { assembleChunks, downloadAudio, deleteAudio } from '@/lib/storage/audio'
import { transcribeAudio } from '@/lib/ai/transcribe'
import { list } from '@vercel/blob'

export const maxDuration = 300

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
    // 1. Conta chunks — prefix deve bater com o que o upload-chunk salva
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const { blobs } = await list({ prefix: `chunks/${uploadId}/`, token })
    console.log(`[finalize] list prefix=chunks/${uploadId}/ encontrou ${blobs.length} blobs`)
    const totalChunks = blobs.length

    if (!totalChunks)
      return NextResponse.json({ error: 'Nenhum chunk encontrado' }, { status: 400 })

    console.log(`[finalize] session=${sessionId} chunks=${totalChunks} mime=${mimeType}`)

    // 2. Normaliza MIME para o Whisper
    const safeMime = mimeType.includes('ogg') ? 'audio/ogg'
                   : mimeType.includes('wav') ? 'audio/wav'
                   : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'audio/mp4'
                   : 'audio/webm'

    const ext = safeMime === 'audio/ogg' ? 'ogg'
              : safeMime === 'audio/wav' ? 'wav'
              : safeMime === 'audio/mp4' ? 'mp4'
              : 'webm'

    // 3. Monta arquivo
    await setStatus('assembling')
    const finalUrl = await assembleChunks(uploadId, totalChunks, safeMime, sessionId)
    await sql`
      update audio_uploads set storage_path = ${finalUrl}, status = 'transcribing'
      where upload_id = ${uploadId}
    `

    // 4. Baixa e transcreve
    const audioBuffer = await downloadAudio(finalUrl)
    console.log(`[finalize] buffer=${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`)

    const result = await transcribeAudio(audioBuffer, safeMime, `audio.${ext}`)

    // 5. Salva resultado
    await sql`
      update audio_uploads set
        transcription          = ${result.text},
        transcription_segments = ${JSON.stringify(result.segments)},
        status                 = 'transcribed'
      where upload_id = ${uploadId}
    `
    await sql`update sessions set status = 'processing' where id = ${sessionId}`

    await deleteAudio(finalUrl).catch(() => {})

    console.log(`[finalize] ✅ chars=${result.text.length} segments=${result.segments.length}`)
    return NextResponse.json({ ok: true, transcriptionLength: result.text.length })

  } catch (err: any) {
    await setStatus('error').catch(() => {})
    console.error('[finalize] ❌', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Erro desconhecido' }, { status: 500 })
  }
}