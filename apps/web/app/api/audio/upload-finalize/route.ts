// @route apps/web/app/api/audio/upload-finalize/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import {
  assembleChunks,
  downloadAudio,
  deleteAudio,
} from '@/lib/storage/audio'
import { transcribeAudio } from '@/lib/ai/transcribe'
import { list } from '@vercel/blob'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()

  const uploadId  = body.uploadId
  const mimeType  = body.mimeType ?? 'audio/webm'
  const sessionId = body.sessionId ?? req.headers.get('x-session-id')

  console.log('[finalize] body =', body)
  console.log('[finalize] uploadId =', uploadId)
  console.log('[finalize] sessionId =', sessionId)

  if (!uploadId || !sessionId) {
    console.error('[finalize] ❌ uploadId ou sessionId ausente')
    return NextResponse.json(
      { error: 'uploadId e sessionId são obrigatórios' },
      { status: 400 }
    )
  }

  const setStatus = (status: string) =>
    sql`update audio_uploads set status = ${status} where upload_id = ${uploadId}`

  try {
    // 1. Lista chunks no Vercel Blob
    const { blobs } = await list({
      prefix: `chunks/${uploadId}/`,
    })

    const totalChunks = blobs.length

    if (!totalChunks) {
      console.error('[finalize] ❌ nenhum chunk encontrado')
      return NextResponse.json(
        { error: 'Nenhum chunk encontrado' },
        { status: 400 }
      )
    }

    console.log(
      `[finalize] session=${sessionId} chunks=${totalChunks} mime=${mimeType}`
    )

    // 2. Normaliza MIME (Whisper-safe)
    const normalizedMime =
      mimeType.includes('webm')
        ? 'audio/webm'
        : mimeType.includes('ogg')
        ? 'audio/ogg'
        : mimeType.includes('wav')
        ? 'audio/wav'
        : 'audio/webm'

    const ext =
      normalizedMime === 'audio/ogg'
        ? 'ogg'
        : normalizedMime === 'audio/wav'
        ? 'wav'
        : 'webm'

    // 3. Monta arquivo final
    await setStatus('assembling')

    const finalPath = await assembleChunks(
      uploadId,
      totalChunks,
      normalizedMime,
      sessionId
    )

    await sql`
      update audio_uploads
      set storage_path = ${finalPath},
          status = 'transcribing'
      where upload_id = ${uploadId}
    `

    // 4. Baixa áudio final
    const audioBuffer = await downloadAudio(finalPath)

    // 5. Transcreve
    const result = await transcribeAudio(
      audioBuffer,
      normalizedMime,
      `audio.${ext}`
    )

    // 6. Salva transcrição
    await sql`
      update audio_uploads set
        transcription          = ${result.text},
        transcription_segments = ${JSON.stringify(result.segments)},
        status                 = 'transcribed'
      where upload_id = ${uploadId}
    `

    await sql`
      update sessions
      set status = 'processing'
      where id = ${sessionId}
    `

    // 7. Remove áudio (mantém só texto)
    await deleteAudio(finalPath).catch(() => {})

    console.log(
      `[finalize] ✅ chars=${result.text.length} segments=${result.segments.length}`
    )

    return NextResponse.json({
      ok: true,
      transcriptionLength: result.text.length,
    })
  } catch (err: any) {
    await setStatus('error').catch(() => {})
    console.error('[finalize] ❌', err?.message ?? err)

    return NextResponse.json(
      { error: err?.message ?? 'Erro desconhecido' },
      { status: 500 }
    )
  }
}