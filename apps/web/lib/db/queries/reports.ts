// @route apps/web/lib/db/queries/reports.ts
import { supabase } from '../client'

export interface ReportContent {
  queixa:          string
  historico:       string
  dados:           string
  metas:           string
  proximos_passos: string
}

export interface Report {
  id:           string
  session_id:   string
  content:      ReportContent
  ai_model:     string
  generated_at: string
  updated_at:   string
}

export async function getReport(sessionId: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) throw new Error(`getReport: ${error.message}`)
  return data as Report | null
}

export async function upsertReport(
  sessionId: string,
  content: ReportContent,
  aiModel = 'llama-3.3-70b-versatile'
): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .upsert(
      { session_id: sessionId, content, ai_model: aiModel },
      { onConflict: 'session_id' }
    )
    .select()
    .single()

  if (error) throw new Error(`upsertReport: ${error.message}`)
  return data as Report
}
