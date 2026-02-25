// @route apps/web/lib/db/queries/patients.ts
import { supabase } from '../client'

export interface Patient {
  id:         string
  user_id:    string
  name:       string
  email:      string | null
  phone:      string | null
  birth_date: string | null
  anamnesis:  string | null
  goals:      string | null
  notes:      string | null
  created_at: string
  updated_at: string
}

export async function listPatients(userId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function searchPatients(userId: string, query: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, email, phone, birth_date')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPatient(id: string, userId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function createPatient(
  userId: string,
  input: Partial<Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .insert({ ...input, user_id: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updatePatient(
  id: string,
  userId: string,
  input: Partial<Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deletePatient(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function getPatientSessions(patientId: string, userId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, patient_name, session_type, status, created_at')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}