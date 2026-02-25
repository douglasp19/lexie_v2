// @route apps/web/app/api/webhooks/cleanup/route.ts
// POST → chamado pelo Vercel Cron todo dia às 02:00 UTC
// Deleta áudios expirados do Storage e marca status='deleted' no banco
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'
import { deleteAudio } from '@/lib/storage/audio'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Valida segredo do cron
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { data: expired, error } = await supabase
      .from('audio_uploads')
      .select('id, upload_id, storage_path')
      .lt('expires_at', new Date().toISOString())
      .not('status', 'eq', 'deleted')
      .limit(100)

    if (error) throw new Error(error.message)

    if (!expired?.length) {
      return NextResponse.json({ ok: true, deleted: 0, message: 'Nada para deletar.' })
    }

    console.log(`[cleanup] ${expired.length} áudios expirados para deletar`)

    let deleted = 0
    const errors: string[] = []

    for (const upload of expired) {
      try {
        if (upload.storage_path) {
          await deleteAudio(upload.storage_path)
        }

        await supabase
          .from('audio_uploads')
          .update({ status: 'deleted', storage_path: null })
          .eq('id', upload.id)

        deleted++
      } catch (err: any) {
        const msg = `${upload.upload_id}: ${err.message}`
        errors.push(msg)
        console.error('[cleanup]', msg)
      }
    }

    console.log(`[cleanup] ✅ ${deleted} deletados, ${errors.length} erros`)
    return NextResponse.json({ ok: errors.length === 0, deleted, errors: errors.length ? errors : undefined })

  } catch (err: any) {
    console.error('[cleanup]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
