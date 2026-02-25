// @route apps/web/app/api/audio/upload-init/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, mimeType, totalBytes } = await req.json()

    if (!sessionId || !mimeType) {
      return NextResponse.json({ error: 'sessionId e mimeType são obrigatórios' }, { status: 400 })
    }

    // Valida que a sessão existe
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    const uploadId  = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase.from('audio_uploads').insert({
      session_id: sessionId,
      upload_id:  uploadId,
      mime_type:  mimeType,
      size_bytes: totalBytes ?? null,
      status:     'uploading',
      expires_at: expiresAt,
    })

    if (error) throw new Error(error.message)

    console.log(`[upload-init] session=${sessionId} upload=${uploadId}`)
    return NextResponse.json({ uploadId, expiresAt })
  } catch (err: any) {
    console.error('[upload-init]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}