// @route apps/web/app/api/report/[sessionId]/generate/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getSession } from '@/lib/db/queries/sessions'
import { upsertReport } from '@/lib/db/queries/reports'
import { generateReport } from '@/lib/ai/generate-report'
import { REPORT_MODEL } from '@/lib/ai/generate-report'

export const maxDuration = 60

type Params = { params: Promise<{ sessionId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params
    const session = await getSession(sessionId, userId)

    // Busca transcrição mais recente
    const rows = await sql`
      select transcription from audio_uploads
      where session_id = ${sessionId} and status = 'transcribed'
      order by created_at desc limit 1
    `

    if (!rows[0]?.transcription)
      return NextResponse.json(
        { error: 'Transcrição não encontrada. Aguarde o processamento do áudio.' },
        { status: 404 }
      )

    console.log(`[report/generate] Gerando — session=${sessionId}`)

    const content = await generateReport({
      transcription: rows[0].transcription,
      notes:         session.notes,
      anchorWords:   session.anchor_words,
      patientName:   session.patient_name,
    })

    const report = await upsertReport({
      sessionId,
      userId,
      content,
      aiModel: REPORT_MODEL,
    })

    await sql`update sessions set status = 'done' where id = ${sessionId}`

    console.log(`[report/generate] ✅ report=${report.id}`)
    return NextResponse.json({ report })

  } catch (err: any) {
    console.error('[report/generate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}