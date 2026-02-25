// @route apps/web/app/api/audio/upload-finalize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'
import { assembleChunks, downloadAudio, deleteAudio } from '@/lib/storage/audio'
import { transcribeAudio } from '@/lib/ai/transcribe'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body      = await req.json()
  const uploadId  = body.uploadId
  const mimeType  = body.mimeType ?? 'audio/webm'
  const sessionId = body.sessionId ?? req.headers.get('x-session-id')

  if (!uploadId || !sessionId) {
    return NextResponse.json({ error: 'uploadId e sessionId são obrigatórios' }, { status: 400 })
  }

  const setStatus = (status: string) =>
    supabase.from('audio_uploads').update({ status }).eq('upload_id', uploadId)

  try {
    // 1. Conta chunks
    const { data: chunkList } = await supabase.storage.from('audio-temp').list(`chunks/${uploadId}`)
    const totalChunks = chunkList?.length ?? 0
    if (!totalChunks) return NextResponse.json({ error: 'Nenhum chunk encontrado' }, { status: 400 })

    console.log(`[finalize] session=${sessionId} chunks=${totalChunks} mime=${mimeType}`)

    // 2. Monta arquivo → status: assembling
    await setStatus('assembling')
    const finalPath = await assembleChunks(uploadId, totalChunks, mimeType, sessionId)
    await supabase.from('audio_uploads').update({ storage_path: finalPath, status: 'transcribing' }).eq('upload_id', uploadId)

    // 3. Transcreve → status: transcribing
    const audioBuffer = await downloadAudio(finalPath)
    const ext = mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3'
              : mimeType.includes('mp4') || mimeType.includes('m4a')  ? 'mp4'
              : mimeType.includes('ogg')                              ? 'ogg'
              : mimeType.includes('wav')                              ? 'wav'
              : 'webm'
    const transcription = await transcribeAudio(audioBuffer, mimeType, `audio.${ext}`)

    // 4. Salva resultado
    await supabase.from('audio_uploads').update({ transcription, status: 'transcribed' }).eq('upload_id', uploadId)
    await supabase.from('sessions').update({ status: 'processing' }).eq('id', sessionId)
    await deleteAudio(finalPath).catch(() => {})

    console.log(`[finalize] ✅ chars=${transcription.length}`)
    return NextResponse.json({ ok: true, transcriptionLength: transcription.length })

  } catch (err: any) {
    await setStatus('error')
    console.error('[finalize] ❌', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}