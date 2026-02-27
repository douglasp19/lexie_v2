// @route apps/web/app/api/audio/cancel/[sessionId]/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { deleteAudio } from '@/lib/storage/audio'

type Params = { params: Promise<{ sessionId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params

    const sess = await sql`select id from sessions where id = ${sessionId} and user_id = ${userId} limit 1`
    if (!sess[0]) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

    const uploads = await sql`
      select upload_id, storage_path from audio_uploads
      where session_id = ${sessionId} and status not in ('transcribed', 'deleted')
      order by created_at desc limit 1
    `

    if (uploads[0]) {
      if (uploads[0].storage_path) {
        await deleteAudio(uploads[0].storage_path).catch(() => {})
      }
      // Deleta o registro — assim o polling retorna null e a UI limpa corretamente
      await sql`delete from audio_uploads where upload_id = ${uploads[0].upload_id}`
    }

    await sql`update sessions set status = 'draft' where id = ${sessionId}`

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}