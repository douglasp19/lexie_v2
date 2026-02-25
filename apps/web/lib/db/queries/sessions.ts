// @route apps/web/lib/db/queries/sessions.ts
import { supabase } from '../client'

export type SessionStatus = 'draft' | 'processing' | 'done' | 'error'
export type SessionType   = 'online' | 'presencial'

export interface Session {
  id:           string
  user_id:      string
  patient_name: string
  session_type: SessionType
  notes:        string | null
  anchor_words: string[]
  status:       SessionStatus
  created_at:   string
  updated_at:   string
}

export interface CreateSessionInput {
  user_id:       string
  patient_name:  string
  session_type:  SessionType
  notes?:        string
  anchor_words?: string[]
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id:      input.user_id,
      patient_name: input.patient_name,
      session_type: input.session_type,
      notes:        input.notes ?? null,
      anchor_words: input.anchor_words ?? [],
      status:       'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`createSession: ${error.message}`)
  return data as Session
}

export async function listSessions(userId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`listSessions: ${error.message}`)
  return (data ?? []) as Session[]
}

export async function getSession(id: string, userId: string): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`getSession: ${error.message}`)
  return data as Session
}

export async function updateSession(
  id: string,
  userId: string,
  patch: Partial<Pick<Session, 'notes' | 'anchor_words' | 'status' | 'patient_name' | 'session_type'>>
): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(`updateSession: ${error.message}`)
  return data as Session
}

export async function deleteSession(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(`deleteSession: ${error.message}`)
}
