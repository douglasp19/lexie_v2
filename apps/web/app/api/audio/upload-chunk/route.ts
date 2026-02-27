// @route apps/web/app/api/audio/upload-chunk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadAudioChunk } from "@/lib/storage/audio"

export async function POST(req: NextRequest) {
  try {
    const uploadId = req.headers.get('x-upload-id')
    const chunkIndex = Number(req.headers.get('x-chunk-index') ?? '0')
    const total = Number(req.headers.get('x-total-chunks') ?? '1')

    if (!uploadId) {
      return NextResponse.json({ error: 'x-upload-id obrigatório' }, { status: 400 })
    }

    const formData = await req.formData()
    const chunk = formData.get('chunk') as File | null

    if (!chunk) {
      return NextResponse.json({ error: 'chunk ausente' }, { status: 400 })
    }

    const buffer = Buffer.from(await chunk.arrayBuffer())
    await uploadAudioChunk(
      `audio/${uploadId}/chunk-${chunkIndex}`,
      buffer,
      "audio/webm"
    );

    console.log(`[upload-chunk] upload=${uploadId} chunk=${chunkIndex}/${total}`)
    return NextResponse.json({ ok: true, chunkIndex, total })
  } catch (err: any) {
    console.error('[upload-chunk]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}