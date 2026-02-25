// @route apps/web/app/api/patients/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { listPatients, createPatient, searchPatients } from '@/lib/db/queries/patients'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const q = req.nextUrl.searchParams.get('q')

    const patients = q
      ? await searchPatients(userId, q)
      : await listPatients(userId)

    return NextResponse.json({ patients })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const patient = await createPatient(userId, {
      name:       body.name.trim(),
      email:      body.email || null,
      phone:      body.phone || null,
      birth_date: body.birth_date || null,
      anamnesis:  body.anamnesis || null,
      goals:      body.goals || null,
      notes:      body.notes || null,
    })

    return NextResponse.json({ patient }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}