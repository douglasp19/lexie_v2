// @route apps/web/app/api/audio/retry/[sessionId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'
import { assembleChunks, downloadAudio, deleteAudio } from '@/lib/storage/audio'
import { transcribeAudio } from '@/lib/ai/transcribe'

export const maxDuration = 300

type Params = { params: Promise<{ sessionId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { sessionId } = await params

  const setStatus = (uploadId: string, status: string) =>
    supabase.from('audio_uploads').update({ status }).eq('upload_id', uploadId)

  try {
    // Busca o upload mais recente da sessão com erro ou preso
    const { data: upload } = await supabase
      .from('audio_uploads')
      .select('*')
      .eq('session_id', sessionId)
      .in('status', ['error', 'uploading', 'assembling', 'transcribing', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!upload) {
      return NextResponse.json({ error: 'Nenhum upload para tentar novamente' }, { status: 404 })
    }

    const uploadId = upload.upload_id
    const mimeType = upload.mime_type ?? 'audio/webm'

    console.log(`[retry] session=${sessionId} upload=${uploadId} status=${upload.status}`)

    // Se já tem storage_path (arquivo montado), pula o assemble
    let finalPath = upload.storage_path

    if (!finalPath) {
      // Precisa montar de novo — verifica se chunks existem
      const { data: chunkList } = await supabase.storage
        .from('audio-temp').list(`chunks/${uploadId}`)

      if (!chunkList?.length) {
        return NextResponse.json({ error: 'Chunks não encontrados — envie o arquivo novamente' }, { status: 404 })
      }

      await setStatus(uploadId, 'assembling')
      finalPath = await assembleChunks(uploadId, chunkList.length, mimeType, sessionId)
      await supabase.from('audio_uploads')
        .update({ storage_path: finalPath, status: 'transcribing' })
        .eq('upload_id', uploadId)
    } else {
      await setStatus(uploadId, 'transcribing')
    }

    // Transcreve
    const audioBuffer = await downloadAudio(finalPath)
    const ext = mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3'
              : mimeType.includes('mp4') || mimeType.includes('m4a')  ? 'mp4'
              : mimeType.includes('ogg')                              ? 'ogg'
              : mimeType.includes('wav')                              ? 'wav'
              : 'webm'
    const transcription = await transcribeAudio(audioBuffer, mimeType, `audio.${ext}`)

    await supabase.from('audio_uploads')
      .update({ transcription, status: 'transcribed' })
      .eq('upload_id', uploadId)

    await supabase.from('sessions').update({ status: 'processing' }).eq('id', sessionId)
    await deleteAudio(finalPath).catch(() => {})

    console.log(`[retry] ✅ chars=${transcription.length}`)
    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[retry] ❌', err.message)
    // Marca como erro para o usuário ver
    const { data: upload } = await supabase
      .from('audio_uploads').select('upload_id').eq('session_id', sessionId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (upload) await setStatus(upload.upload_id, 'error')
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}