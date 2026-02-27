// @route apps/web/app/api/templates/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const rows = await sql`
      select * from anamnesis_templates
      where user_id = ${userId}
      order by created_at desc
    `
    return NextResponse.json({ templates: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { title, content } = await req.json()
    if (!title?.trim())   return NextResponse.json({ error: 'title obrigatorio' },   { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'content obrigatorio' }, { status: 400 })

    const rows = await sql`
      insert into anamnesis_templates (user_id, title, content)
      values (${userId}, ${title.trim()}, ${content.trim()})
      returning *
    `
    return NextResponse.json({ template: rows[0] }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}