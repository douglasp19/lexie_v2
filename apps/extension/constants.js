// @route apps/extension/constants.js

export const RECORDING_STATE = {
  IDLE:       'idle',
  RECORDING:  'recording',
  UPLOADING:  'uploading',
  DONE:       'done',
  ERROR:      'error',
};

export const MSG = {
  // popup → background
  START:           'START',
  STOP:            'STOP',
  STATUS:          'STATUS',
  RESET:           'RESET',           // volta ao IDLE sem gravar

  // background → offscreen
  OFFSCREEN_START: 'OFFSCREEN_START',
  OFFSCREEN_STOP:  'OFFSCREEN_STOP',

  // offscreen → background
  UPLOAD_DONE:     'UPLOAD_DONE',
  UPLOAD_ERROR:    'UPLOAD_ERROR',
  UPLOAD_PROGRESS: 'UPLOAD_PROGRESS',
};

export const CONFIG = {
  // Troque pela URL real em produção
  API_BASE: 'http://localhost:3000/api',

  // ─────────────────────────────────────────────────────────
  //  TEST_MODE = true  → salva o áudio como download local
  //                      em vez de fazer upload para o backend
  //              false → envia para API_BASE (produção)
  // ─────────────────────────────────────────────────────────
  TEST_MODE: false,

  // Formatos de áudio em ordem de preferência
  MIME_TYPE_CANDIDATES: [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ],

  // Salva um chunk a cada 5s (proteção contra crashes)
  TIMESLICE_MS: 5000,

  // Tamanho máximo por parte no upload chunked (5 MB)
  CHUNK_SIZE_BYTES: 5 * 1024 * 1024,

  // Retry de upload
  UPLOAD_MAX_RETRIES:    3,
  UPLOAD_RETRY_DELAY_MS: 2000,
};
