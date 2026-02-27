// @route apps/web/lib/db/queries/sessions.ts
import { sql } from '../client'

export type SessionStatus = 'draft' | 'processing' | 'done' | 'error'
export type SessionType   = 'online' | 'presencial'

export interface Session {
  id: string; user_id: string; patient_id: string | null
  patient_name: string; session_type: SessionType
  notes: string | null; anchor_words: string[]
  status: SessionStatus; created_at: string; updated_at: string
}

export interface CreateSessionInput {
  user_id: string; patient_name: string; session_type: SessionType
  notes?: string | null; anchor_words?: string[]; patient_id?: string
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const rows = await sql`
    insert into sessions (user_id, patient_id, patient_name, session_type, notes, anchor_words, status)
    values (${input.user_id}, ${input.patient_id ?? null}, ${input.patient_name},
            ${input.session_type}, ${input.notes ?? null}, ${input.anchor_words ?? []}, 'draft')
    returning *`
  return rows[0] as Session
}

export async function listSessions(userId: string): Promise<Session[]> {
  return sql`select * from sessions where user_id = ${userId} order by created_at desc` as any
}

export async function getSession(id: string, userId: string): Promise<Session> {
  const rows = await sql`select * from sessions where id = ${id} and user_id = ${userId} limit 1`
  if (!rows[0]) throw new Error('Session not found')
  return rows[0] as Session
}

export async function updateSession(
  id: string, userId: string,
  patch: Partial<Pick<Session, 'notes' | 'anchor_words' | 'status' | 'patient_name' | 'session_type' | 'patient_id'>>
): Promise<Session> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return getSession(id, userId)

  // Monta SET dinâmico
  const sets = entries.map(([k]) => `${k} = $${k}`).join(', ')
  const vals = Object.fromEntries(entries)

  const rows = await sql`
    update sessions set ${sql(vals)} where id = ${id} and user_id = ${userId} returning *`
  if (!rows[0]) throw new Error('Session not found')
  return rows[0] as Session
}

export async function deleteSession(id: string, userId: string): Promise<void> {
  await sql`delete from sessions where id = ${id} and user_id = ${userId}`
}