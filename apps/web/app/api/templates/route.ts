// @route apps/web/app/api/templates/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('anamnesis_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json({ templates: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const { title, content } = await req.json()
    if (!title?.trim())   return NextResponse.json({ error: 'title obrigatorio' },   { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'content obrigatorio' }, { status: 400 })

    const { data, error } = await supabase
      .from('anamnesis_templates')
      .insert({ user_id: userId, title: title.trim(), content: content.trim() })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ template: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}