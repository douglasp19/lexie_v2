// @route apps/web/app/api/webhooks/cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { deleteAudio } from '@/lib/storage/audio'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const expired = await sql`
      select upload_id, storage_path from audio_uploads
      where expires_at < now() and status not in ('deleted', 'error')
      limit 100
    `

    if (!expired.length)
      return NextResponse.json({ ok: true, deleted: 0, message: 'Nada para deletar.' })

    console.log(`[cleanup] ${expired.length} áudios expirados`)

    let deleted = 0
    const errors: string[] = []

    for (const upload of expired) {
      try {
        if (upload.storage_path) await deleteAudio(upload.storage_path)
        await sql`
          update audio_uploads set status = 'deleted', storage_path = null
          where upload_id = ${upload.upload_id}
        `
        deleted++
      } catch (err: any) {
        errors.push(`${upload.upload_id}: ${err.message}`)
        console.error('[cleanup]', err.message)
      }
    }

    console.log(`[cleanup] ✅ ${deleted} deletados, ${errors.length} erros`)
    return NextResponse.json({ ok: errors.length === 0, deleted, errors: errors.length ? errors : undefined })

  } catch (err: any) {
    console.error('[cleanup]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}