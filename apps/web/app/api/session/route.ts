// @route apps/web/app/api/session/route.ts
// GET  → lista sessões do usuário
// POST → cria nova sessão
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSession, listSessions } from '@/lib/db/queries/sessions'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const sessions = await listSessions(userId)
    return NextResponse.json({ sessions })
  } catch (err: any) {
    console.error('[GET /api/session]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { patient_name, session_type, notes, anchor_words } = await req.json()

    if (!patient_name?.trim()) {
      return NextResponse.json({ error: 'patient_name é obrigatório' }, { status: 400 })
    }

    const session = await createSession({
      user_id:      userId,
      patient_name: patient_name.trim(),
      session_type: session_type ?? 'online',
      notes:        notes ?? null,
      anchor_words: anchor_words ?? [],
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/session]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
