// @route apps/web/app/api/report/[sessionId]/generate/route.ts
// POST → busca transcrição + notas + âncoras → Groq LLM → salva relatório
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'
import { getSession } from '@/lib/db/queries/sessions'
import { upsertReport } from '@/lib/db/queries/reports'
import { generateReport } from '@/lib/ai/generate-report'

export const maxDuration = 60

type Params = { params: Promise<{ sessionId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params

    // 1. Valida que a sessão pertence ao usuário
    const session = await getSession(sessionId, userId)

    // 2. Busca transcrição mais recente
    const { data: upload, error: uploadErr } = await supabase
      .from('audio_uploads')
      .select('transcription')
      .eq('session_id', sessionId)
      .eq('status', 'transcribed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (uploadErr || !upload?.transcription) {
      return NextResponse.json(
        { error: 'Transcrição não encontrada. Aguarde o processamento do áudio.' },
        { status: 404 }
      )
    }

    // 3. Gera relatório com Groq LLM
    console.log(`[report/generate] Gerando relatório — session=${sessionId}`)

    const content = await generateReport({
      transcription: upload.transcription,
      notes:         session.notes,
      anchorWords:   session.anchor_words,
      patientName:   session.patient_name,
    })

    // 4. Salva relatório (upsert — permite regenerar)
    const report = await upsertReport(sessionId, content)

    // 5. Atualiza status da sessão
    await supabase
      .from('sessions')
      .update({ status: 'done' })
      .eq('id', sessionId)

    console.log(`[report/generate] ✅ Relatório salvo — report=${report.id}`)
    return NextResponse.json({ report })

  } catch (err: any) {
    console.error('[report/generate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
