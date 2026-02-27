// @route apps/web/lib/db/queries/patients.ts
import { sql } from '../client'

export interface Patient {
  id: string; user_id: string; name: string; email: string | null
  phone: string | null; birth_date: string | null; anamnesis: string | null
  goals: string | null; notes: string | null; created_at: string; updated_at: string
}

export async function listPatients(userId: string): Promise<Patient[]> {
  return sql`select * from patients where user_id = ${userId} order by name asc` as any
}

export async function searchPatients(userId: string, q: string): Promise<Patient[]> {
  return sql`
    select * from patients
    where user_id = ${userId} and name ilike ${'%' + q + '%'}
    order by name asc limit 20` as any
}

export async function getPatient(id: string, userId: string): Promise<Patient | null> {
  const rows = await sql`select * from patients where id = ${id} and user_id = ${userId} limit 1`
  return (rows[0] as Patient) ?? null
}

export async function createPatient(input: {
  user_id: string; name: string; email?: string | null; phone?: string | null
  birth_date?: string | null; anamnesis?: string | null; goals?: string | null; notes?: string | null
}): Promise<Patient> {
  const rows = await sql`
    insert into patients (user_id, name, email, phone, birth_date, anamnesis, goals, notes)
    values (${input.user_id}, ${input.name}, ${input.email ?? null}, ${input.phone ?? null},
            ${input.birth_date ?? null}, ${input.anamnesis ?? null}, ${input.goals ?? null}, ${input.notes ?? null})
    returning *`
  return rows[0] as Patient
}

export async function updatePatient(
  id: string, userId: string,
  patch: Partial<Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Patient> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return (await getPatient(id, userId))!
  const vals = Object.fromEntries(entries)
  const rows = await sql`update patients set ${sql(vals)} where id = ${id} and user_id = ${userId} returning *`
  if (!rows[0]) throw new Error('Patient not found')
  return rows[0] as Patient
}

export async function deletePatient(id: string, userId: string): Promise<void> {
  await sql`delete from patients where id = ${id} and user_id = ${userId}`
}

export async function getPatientSessions(patientId: string, userId: string) {
  return sql`
    select * from sessions
    where patient_id = ${patientId} and user_id = ${userId}
    order by created_at desc` as any
}