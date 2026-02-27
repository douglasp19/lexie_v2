// @route apps/web/app/api/report/[sessionId]/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getReport, patchReport } from '@/lib/db/queries/reports'
import { getSession } from '@/lib/db/queries/sessions'

type Params = { params: Promise<{ sessionId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params
    const report = await getReport(sessionId)

    if (!report)
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })

    return NextResponse.json({ report })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { sessionId } = await params
    await getSession(sessionId, userId)

    const body = await req.json()
    const ALLOWED = ['queixa', 'historico', 'dados', 'metas', 'proximos_passos'] as const

    const patch = Object.fromEntries(
      Object.entries(body).filter(([k]) => (ALLOWED as readonly string[]).includes(k))
    )

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: `Campos permitidos: ${ALLOWED.join(', ')}` }, { status: 400 })

    for (const [key, val] of Object.entries(patch))
      if (typeof val !== 'string')
        return NextResponse.json({ error: `Campo "${key}" deve ser string` }, { status: 400 })

    const report = await patchReport(sessionId, patch)
    return NextResponse.json({ report })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}