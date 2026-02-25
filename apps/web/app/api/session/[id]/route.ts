// @route apps/web/app/api/session/[id]/route.ts
// GET    → busca sessão por ID
// PATCH  → atualiza campos
// DELETE → remove sessão
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, deleteSession } from '@/lib/db/queries/sessions'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    const session = await getSession(id, userId)
    return NextResponse.json({ session })
  } catch (err: any) {
    const status = err.message.includes('No rows') ? 404 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id }  = await params
    const body    = await req.json()
    const allowed = ['notes', 'anchor_words', 'status', 'patient_name', 'session_type'] as const

    const patch = Object.fromEntries(
      Object.entries(body).filter(([k]) => (allowed as readonly string[]).includes(k))
    )

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    const session = await updateSession(id, userId, patch as any)
    return NextResponse.json({ session })
  } catch (err: any) {
    console.error('[PATCH /api/session/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    await deleteSession(id, userId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /api/session/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
