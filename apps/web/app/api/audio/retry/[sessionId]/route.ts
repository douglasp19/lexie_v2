// @route apps/web/app/api/audio/retry/[sessionId]/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { downloadAudio } from '@/lib/storage/audio'
import { transcribeAudio } from '@/lib/ai/transcribe'

export const maxDuration = 300

type Params = { params: Promise<{ sessionId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params

    // Valida que a sessão pertence ao usuário
    const sessRows = await sql`select id from sessions where id = ${sessionId} and user_id = ${userId} limit 1`
    if (!sessRows[0])
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

    // Busca upload com erro
    const upRows = await sql`
      select upload_id, storage_path, mime_type from audio_uploads
      where session_id = ${sessionId} and status in ('error', 'assembling', 'transcribing')
      order by created_at desc limit 1
    `
    if (!upRows[0])
      return NextResponse.json({ error: 'Nenhum upload para reprocessar' }, { status: 404 })

    const upload = upRows[0]
    if (!upload.storage_path)
      return NextResponse.json({ error: 'Arquivo de áudio não encontrado no storage' }, { status: 400 })

    console.log(`[audio/retry] Reprocessando upload=${upload.upload_id}`)

    await sql`update audio_uploads set status = 'transcribing' where upload_id = ${upload.upload_id}`

    const audioBuffer = await downloadAudio(upload.storage_path)
    const mimeType    = upload.mime_type ?? 'audio/webm'
    const ext         = mimeType.includes('ogg') ? 'ogg' : 'webm'

    const result = await transcribeAudio(audioBuffer, mimeType, `audio.${ext}`)

    await sql`
      update audio_uploads set
        transcription          = ${result.text},
        transcription_segments = ${JSON.stringify(result.segments)},
        status                 = 'transcribed'
      where upload_id = ${upload.upload_id}
    `
    await sql`update sessions set status = 'processing' where id = ${sessionId}`

    console.log(`[audio/retry] ✅ chars=${result.text.length}`)
    return NextResponse.json({ ok: true, transcriptionLength: result.text.length })
  } catch (err: any) {
    console.error('[audio/retry] ❌', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}