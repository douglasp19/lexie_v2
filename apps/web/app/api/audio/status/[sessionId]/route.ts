// @route apps/web/app/api/audio/status/[sessionId]/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

type Params = { params: Promise<{ sessionId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params

    const rows = await sql`
      select status, transcription, transcription_segments
      from audio_uploads
      where session_id = ${sessionId}
      order by created_at desc
      limit 1
    `

    return NextResponse.json({ upload: rows[0] ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}