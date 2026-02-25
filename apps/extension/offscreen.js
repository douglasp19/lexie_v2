// @route apps/extension/offscreen.js

/**
 * Roda dentro do Offscreen Document (invisível ao usuário).
 *
 * Correções desta versão:
 *   ✅ Passthrough de áudio — o usuário continua ouvindo a aba normalmente
 *   ✅ Microfone misturado ao áudio da aba no mesmo arquivo
 *   ✅ TEST_MODE — gera download do .webm localmente em vez de fazer upload
 */

import { MSG, CONFIG } from './constants.js';

// ─── Estado ──────────────────────────────────────────────────────────────────

let mediaRecorder    = null;
let audioChunks      = [];
let audioContext     = null;   // AudioContext para mixagem
let currentSessionId = null;

// ─── Utilitários ─────────────────────────────────────────────────────────────

function getBestMimeType() {
  return CONFIG.MIME_TYPE_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

function toBackground(type, payload = {}) {
  chrome.runtime.sendMessage({ type, ...payload });
}

// ─── Mixagem de áudio ─────────────────────────────────────────────────────────
//
// Diagrama de conexões:
//
//   tabStream ──► tabSource ──┬──► context.destination  (passthrough → fone/caixa)
//                             └──► mixDestination        ┐
//                                                         ├──► MediaRecorder
//   micStream ──► micSource ───────► mixDestination       ┘
//
// Resultado: o usuário ouve normalmente E o MediaRecorder grava os dois canais.

async function buildMixedStream(tabStream, micGranted = false) {
  audioContext = new AudioContext();

  // Fonte da aba
  const tabSource = audioContext.createMediaStreamSource(tabStream);

  // ─ Passthrough: aba continua saindo nos fones/caixa normalmente
  tabSource.connect(audioContext.destination);

  // ─ Destino da gravação (stream que vai para o MediaRecorder)
  const mixDestination = audioContext.createMediaStreamDestination();

  // Aba → gravação
  tabSource.connect(mixDestination);

  // Microfone → gravação
  // micGranted=true significa que o popup já abriu o diálogo e o usuário aceitou.
  // Nesse caso o getUserMedia aqui funciona silenciosamente, sem prompt.
  if (micGranted) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(mixDestination);
      console.log('[Lexie offscreen] ✅ Microfone conectado ao mix.');
    } catch (err) {
      console.warn('[Lexie offscreen] Microfone falhou mesmo com permissão:', err.message);
    }
  } else {
    console.warn('[Lexie offscreen] Microfone sem permissão — gravando só a aba.');
  }

  return mixDestination.stream;
}

// ─── TEST_MODE: baixar arquivo localmente ────────────────────────────────────

function downloadBlob(blob, sessionId) {
  const ext      = blob.type.includes('ogg') ? 'ogg' : 'webm';
  const filename = `lexie-teste-${sessionId}-${Date.now()}.${ext}`;
  const url      = URL.createObjectURL(blob);

  // Cria um <a> temporário e dispara o download
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Libera o object URL após 60s
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  console.log(`[Lexie offscreen] Download disparado: ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
}

// ─── Upload chunked (produção) ────────────────────────────────────────────────

function splitBlob(blob, chunkSize) {
  const parts = [];
  let offset  = 0;
  while (offset < blob.size) {
    parts.push(blob.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }
  return parts;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options, attempt = 0) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (attempt >= CONFIG.UPLOAD_MAX_RETRIES) throw err;
    await sleep(CONFIG.UPLOAD_RETRY_DELAY_MS * (attempt + 1));
    return fetchWithRetry(url, options, attempt + 1);
  }
}

async function uploadAudio(blob, sessionId) {
  // 1. Iniciar upload
  const initRes = await fetchWithRetry(`${CONFIG.API_BASE}/audio/upload-init`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      mimeType:   blob.type,
      totalBytes: blob.size,
      capturedAt: new Date().toISOString(),
    }),
  });
  if (!initRes.ok) throw new Error(`upload-init falhou: ${initRes.status}`);
  const { uploadId } = await initRes.json();

  // 2. Chunks
  const chunks = splitBlob(blob, CONFIG.CHUNK_SIZE_BYTES);
  for (let i = 0; i < chunks.length; i++) {
    const form = new FormData();
    form.append('chunk', chunks[i], `chunk_${i}.webm`);
    const res = await fetchWithRetry(`${CONFIG.API_BASE}/audio/upload-chunk`, {
      method:  'POST',
      headers: {
        'X-Session-Id':   sessionId,
        'X-Upload-Id':    uploadId,
        'X-Chunk-Index':  String(i),
        'X-Total-Chunks': String(chunks.length),
      },
      body: form,
    });
    if (!res.ok) throw new Error(`Chunk ${i} falhou: ${res.status}`);
    toBackground(MSG.UPLOAD_PROGRESS, {
      progress: Math.round(((i + 1) / chunks.length) * 100),
    });
  }

  // 3. Finalizar
  const finalRes = await fetchWithRetry(`${CONFIG.API_BASE}/audio/upload-finalize`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, uploadId }),
  });
  if (!finalRes.ok) throw new Error(`upload-finalize falhou: ${finalRes.status}`);
  return finalRes.json();
}

// ─── Gravação ─────────────────────────────────────────────────────────────────

async function startRecording({ streamId, sessionId, micGranted = false }) {
  currentSessionId = sessionId;
  audioChunks      = [];

  // 1. Stream da aba via tabCapture
  let tabStream;
  try {
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource:   'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });
  } catch (err) {
    console.error('[Lexie offscreen] getUserMedia (tab) falhou:', err);
    toBackground(MSG.UPLOAD_ERROR, { error: err.message });
    return;
  }

  // 2. Mixar aba + mic (micGranted vem do popup que já pediu a permissão)
  const mixedStream = await buildMixedStream(tabStream, micGranted);

  // 3. Iniciar MediaRecorder com o stream mixado
  const mimeType    = getBestMimeType();
  mediaRecorder     = new MediaRecorder(mixedStream, mimeType ? { mimeType } : {});

  mediaRecorder.ondataavailable = ({ data }) => {
    if (data?.size > 0) audioChunks.push(data);
  };

  mediaRecorder.onerror = ({ error }) => {
    toBackground(MSG.UPLOAD_ERROR, { error: error?.message ?? 'MediaRecorder error' });
  };

  mediaRecorder.start(CONFIG.TIMESLICE_MS);
  console.log('[Lexie offscreen] Gravando aba + mic. Sessão:', sessionId, '| MIME:', mimeType);
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    toBackground(MSG.UPLOAD_ERROR, { error: 'MediaRecorder não estava ativo.' });
    return;
  }

  // Aguarda último chunk
  await new Promise(resolve => {
    mediaRecorder.onstop = resolve;
    mediaRecorder.stop();
  });

  // Fechar AudioContext libera o passthrough e para qualquer stream aberto
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
  console.log(`[Lexie offscreen] Gravação finalizada. Tamanho: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);

  try {
    if (CONFIG.TEST_MODE) {
      // ── Modo de teste: baixa o arquivo localmente
      downloadBlob(audioBlob, currentSessionId);
      toBackground(MSG.UPLOAD_DONE, { sessionId: currentSessionId, testMode: true });
    } else {
      // ── Produção: envia para o backend
      await uploadAudio(audioBlob, currentSessionId);
      toBackground(MSG.UPLOAD_DONE, { sessionId: currentSessionId });
    }
  } catch (err) {
    console.error('[Lexie offscreen] Falha:', err);
    toBackground(MSG.UPLOAD_ERROR, { error: err.message });
  } finally {
    mediaRecorder    = null;
    audioChunks      = [];
    currentSessionId = null;
  }
}

// ─── Listener ────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return;
  switch (message.type) {
    case MSG.OFFSCREEN_START: startRecording(message); break;
    case MSG.OFFSCREEN_STOP:  stopRecording();          break;
  }
});

console.log('[Lexie offscreen] Pronto. TEST_MODE =', CONFIG.TEST_MODE);
