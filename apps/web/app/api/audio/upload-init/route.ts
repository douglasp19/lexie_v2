// @route apps/web/app/api/audio/upload-init/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, mimeType, totalBytes } = await req.json()

    if (!sessionId || !mimeType)
      return NextResponse.json({ error: 'sessionId e mimeType são obrigatórios' }, { status: 400 })

    // Valida que a sessão existe
    const rows = await sql`select id from sessions where id = ${sessionId} limit 1`
    if (!rows[0])
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

    const uploadId  = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await sql`
      insert into audio_uploads (upload_id, session_id, user_id, mime_type, total_bytes, status, expires_at)
      select ${uploadId}, id, user_id, ${mimeType}, ${totalBytes ?? null}, 'uploading', ${expiresAt}
      from sessions where id = ${sessionId}
    `

    console.log(`[upload-init] session=${sessionId} upload=${uploadId}`)
    return NextResponse.json({ uploadId, expiresAt })
  } catch (err: any) {
    console.error('[upload-init]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}