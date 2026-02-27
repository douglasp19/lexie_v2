// @route apps/web/app/api/templates/[id]/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    const { title, content } = await req.json()

    const rows = await sql`
      update anamnesis_templates
      set title = ${title}, content = ${content}
      where id = ${id} and user_id = ${userId}
      returning *
    `
    if (!rows[0]) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json({ template: rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    await sql`delete from anamnesis_templates where id = ${id} and user_id = ${userId}`
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}