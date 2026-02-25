// @route apps/web/app/api/report/[sessionId]/route.ts
// GET → retorna relatório gerado para a sessão
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getReport } from '@/lib/db/queries/reports'

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
