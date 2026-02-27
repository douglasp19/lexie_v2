// @route apps/web/lib/db/queries/audio.ts
import { sql } from '../client'
import type { TranscriptionSegment } from '@/lib/ai/transcribe'

export interface AudioUpload {
  upload_id:              string
  session_id:             string
  user_id:                string
  status:                 string
  storage_path:           string | null
  mime_type:              string | null
  total_bytes:            number | null
  transcription:          string | null
  transcription_segments: TranscriptionSegment[] | null
  expires_at:             string
  created_at:             string
  updated_at:             string
}

export async function createAudioUpload(input: {
  sessionId:  string
  userId:     string
  mimeType:   string
  totalBytes: number
}): Promise<AudioUpload> {
  const rows = await sql`
    insert into audio_uploads (session_id, user_id, mime_type, total_bytes, status)
    values (${input.sessionId}, ${input.userId}, ${input.mimeType}, ${input.totalBytes}, 'uploading')
    returning *`
  return rows[0] as AudioUpload
}

export async function getAudioUpload(sessionId: string): Promise<AudioUpload | null> {
  const rows = await sql`
    select * from audio_uploads
    where session_id = ${sessionId}
    order by created_at desc limit 1`
  return (rows[0] as AudioUpload) ?? null
}

export async function updateAudioUpload(
  uploadId: string,
  vals: Record<string, any>
) {
  const entries = Object.entries(vals)

  if (entries.length === 0) return

  const sets = entries.map(
    ([key], i) => sql`${sql.identifier([key])} = ${entries[i][1]}`
  )

  await sql`
    update audio_uploads
    set ${sql.join(sets, sql`, `)}
    where upload_id = ${uploadId}
  `
}

export async function getExpiredUploads(): Promise<AudioUpload[]> {
  return sql`
    select * from audio_uploads
    where expires_at < now() and status not in ('deleted', 'error')` as any
}