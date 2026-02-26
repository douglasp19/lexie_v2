// @route apps/web/app/api/report/[sessionId]/route.ts
// GET   → retorna relatório gerado para a sessão
// PATCH → edição manual de uma ou mais seções do relatório
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getReport } from '@/lib/db/queries/reports'
import { getSession } from '@/lib/db/queries/sessions'
import { supabase } from '@/lib/db/client'

type Params = { params: Promise<{ sessionId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params
    const report = await getReport(sessionId)

    if (!report) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (err: any) {
    console.error('[GET /api/report/[sessionId]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/report/[sessionId]
// Body: qualquer subconjunto de { queixa, historico, dados, metas, proximos_passos }
// Faz merge com o conteúdo existente — não sobrescreve campos não enviados
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params

    // Garante que a sessão pertence ao usuário
    await getSession(sessionId, userId)

    const body = await req.json()
    const ALLOWED_KEYS = ['queixa', 'historico', 'dados', 'metas', 'proximos_passos'] as const

    const patch = Object.fromEntries(
      Object.entries(body).filter(([k]) => (ALLOWED_KEYS as readonly string[]).includes(k))
    )

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: `Nenhum campo válido. Campos permitidos: ${ALLOWED_KEYS.join(', ')}` },
        { status: 400 }
      )
    }

    // Valida que todos os valores enviados são strings
    for (const [key, val] of Object.entries(patch)) {
      if (typeof val !== 'string') {
        return NextResponse.json({ error: `Campo "${key}" deve ser string` }, { status: 400 })
      }
    }

    // Busca conteúdo atual para fazer merge
    const existing = await getReport(sessionId)
    if (!existing) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    const mergedContent = { ...existing.content, ...patch }

    const { data, error } = await supabase
      .from('reports')
      .update({ content: mergedContent })
      .eq('session_id', sessionId)
      .select()
      .single()

    if (error) throw new Error(error.message)

    console.log(`[PATCH /api/report/${sessionId}] Campos atualizados: ${Object.keys(patch).join(', ')}`)
    return NextResponse.json({ report: data })
  } catch (err: any) {
    console.error('[PATCH /api/report/[sessionId]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}