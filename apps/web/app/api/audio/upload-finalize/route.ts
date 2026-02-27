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
    // 1. Conta chunks no Vercel Blob
    const { blobs } = await list({ prefix: `chunks/${uploadId}/` })
    const totalChunks = blobs.length
    if (!totalChunks)
      return NextResponse.json({ error: 'Nenhum chunk encontrado' }, { status: 400 })

    console.log(`[finalize] session=${sessionId} chunks=${totalChunks} mime=${mimeType}`)

    // 2. Monta arquivo → status: assembling
    await setStatus('assembling')
    const finalPath = await assembleChunks(uploadId, totalChunks, mimeType, sessionId)
    await sql`
      update audio_uploads set storage_path = ${finalPath}, status = 'transcribing'
      where upload_id = ${uploadId}
    `

    // 3. Transcreve
    const audioBuffer = await downloadAudio(finalPath)
    const ext = mimeType.includes('ogg') ? 'ogg'
              : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'mp4'
              : mimeType.includes('wav') ? 'wav'
              : 'webm'

    const result = await transcribeAudio(audioBuffer, mimeType, `audio.${ext}`)

    // 4. Salva transcrição + segmentos
    await sql`
      update audio_uploads set
        transcription          = ${result.text},
        transcription_segments = ${JSON.stringify(result.segments)},
        status                 = 'transcribed'
      where upload_id = ${uploadId}
    `
    await sql`update sessions set status = 'processing' where id = ${sessionId}`

    // 5. Deleta áudio (mantém só a transcrição)
    await deleteAudio(finalPath).catch(() => {})

    console.log(`[finalize] ✅ chars=${result.text.length} segments=${result.segments.length}`)
    return NextResponse.json({ ok: true, transcriptionLength: result.text.length })

  } catch (err: any) {
    await setStatus('error').catch(() => {})
    console.error('[finalize] ❌', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}