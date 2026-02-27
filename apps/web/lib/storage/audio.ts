// lib/storage/audio.ts
import { put, del, list, head } from "@vercel/blob";

/**
 * Upload de um chunk individual
 * path exemplo: chunks/{uploadId}/chunk-0
 */
export async function uploadAudioChunk(
  path: string,
  buffer: Buffer,
  contentType = "application/octet-stream"
) {
  return await put(path, buffer, {
    access: "private",
    contentType,
  });
}

/**
 * Monta o áudio final a partir dos chunks
 * Retorna o path do arquivo final
 */
export async function assembleChunks(
  uploadId: string,
  totalChunks: number,
  mimeType: string,
  sessionId: string
): Promise<string> {
  const chunksPrefix = `chunks/${uploadId}/`;
  const finalPath = `audio/${sessionId}/${uploadId}.bin`;

  const buffers: Buffer[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = `${chunksPrefix}chunk-${i}`;
    const res = await fetch((await head(chunkPath)).url);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }

  const finalBuffer = Buffer.concat(buffers);

  await put(finalPath, finalBuffer, {
    access: "private",
    contentType: mimeType,
  });

  // limpa chunks
  await deleteAudio(chunksPrefix);

  return finalPath;
}

/**
 * Faz download do áudio final e retorna Buffer
 */
export async function downloadAudio(path: string): Promise<Buffer> {
  const res = await fetch((await head(path)).url);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Deleta um arquivo OU um prefixo inteiro
 */
export async function deleteAudio(pathOrPrefix: string) {
  const { blobs } = await list({ prefix: pathOrPrefix });

  await Promise.all(
    blobs.map((blob) => del(blob.url))
  );
}