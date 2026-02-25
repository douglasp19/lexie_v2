// @route apps/web/app/api/patients/[id]/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPatient, updatePatient, deletePatient, getPatientSessions } from '@/lib/db/queries/patients'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    const [patient, sessions] = await Promise.all([
      getPatient(id, userId),
      getPatientSessions(id, userId),
    ])

    if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

    return NextResponse.json({ patient, sessions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    const body    = await req.json()

    const patient = await updatePatient(id, userId, {
      name:       body.name,
      email:      body.email,
      phone:      body.phone,
      birth_date: body.birth_date,
      anamnesis:  body.anamnesis,
      goals:      body.goals,
      notes:      body.notes,
    })

    return NextResponse.json({ patient })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    await deletePatient(id, userId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}