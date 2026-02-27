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
  id: string,
  userId: string,
  patch: {
    notes?:        string | null
    anchor_words?: string[]
    status?:       SessionStatus
    patient_name?: string
    session_type?: SessionType
    patient_id?:   string | null
  }
): Promise<Session> {
  // UPDATE explícito — evita problemas com sql(vals) dinâmico
  const rows = await sql`
    update sessions set
      notes        = case when ${patch.notes        !== undefined}::boolean then ${patch.notes        ?? null}       else notes        end,
      anchor_words = case when ${patch.anchor_words !== undefined}::boolean then ${patch.anchor_words ?? []}         else anchor_words end,
      status       = case when ${patch.status       !== undefined}::boolean then ${patch.status       ?? null}       else status       end,
      patient_name = case when ${patch.patient_name !== undefined}::boolean then ${patch.patient_name ?? null}       else patient_name end,
      session_type = case when ${patch.session_type !== undefined}::boolean then ${patch.session_type ?? null}::text else session_type end,
      patient_id   = case when ${patch.patient_id   !== undefined}::boolean then ${patch.patient_id   ?? null}::uuid else patient_id   end
    where id = ${id} and user_id = ${userId}
    returning *`
  if (!rows[0]) throw new Error('Session not found')
  return rows[0] as Session
}

export async function deleteSession(id: string, userId: string): Promise<void> {
  await sql`delete from sessions where id = ${id} and user_id = ${userId}`
}