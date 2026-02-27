// @route apps/web/lib/db/queries/reports.ts
import { sql } from '../client'

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
  user_id:      string
  content:      ReportContent
  ai_model:     string
  generated_at: string
  updated_at:   string
}

export async function getReport(sessionId: string): Promise<Report | null> {
  const rows = await sql`select * from reports where session_id = ${sessionId} limit 1`
  return (rows[0] as Report) ?? null
}

export async function upsertReport(params: {
  sessionId: string
  userId:    string
  content:   ReportContent
  aiModel:   string
}): Promise<Report> {
  const rows = await sql`
    insert into reports (session_id, user_id, content, ai_model)
    values (${params.sessionId}, ${params.userId}, ${JSON.stringify(params.content)}, ${params.aiModel})
    on conflict (session_id) do update set
      content      = excluded.content,
      ai_model     = excluded.ai_model,
      generated_at = now()
    returning *`
  return rows[0] as Report
}

export async function patchReport(
  sessionId: string,
  patch:     Partial<ReportContent>
): Promise<Report> {
  // Merge parcial no JSONB
  const rows = await sql`
    update reports
    set content = content || ${JSON.stringify(patch)}::jsonb
    where session_id = ${sessionId}
    returning *`
  if (!rows[0]) throw new Error('Report not found')
  return rows[0] as Report
}