// @route apps/extension/background.js

import { RECORDING_STATE, MSG } from './constants.js';

// ─── Estado ──────────────────────────────────────────────────────────────────

async function getState() {
  const { recordingState } = await chrome.storage.session.get('recordingState');
  return recordingState ?? {
    status:     RECORDING_STATE.IDLE,
    sessionId:  null,
    startedAt:  null,
    tabId:      null,
    elapsedSec: 0,
    error:      null,
  };
}

async function setState(patch) {
  const next = { ...(await getState()), ...patch };
  await chrome.storage.session.set({ recordingState: next });
  updateBadge(next.status);
  return next;
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function updateBadge(status) {
  const map = {
    [RECORDING_STATE.IDLE]:      { text: '',     color: '#888888' },
    [RECORDING_STATE.RECORDING]: { text: 'REC',  color: '#E53E3E' },
    [RECORDING_STATE.UPLOADING]: { text: '↑',    color: '#F4A261' },
    [RECORDING_STATE.DONE]:      { text: '✓',    color: '#4CAF50' },
    [RECORDING_STATE.ERROR]:     { text: '!',    color: '#E53E3E' },
  };
  const cfg = map[status] ?? map[RECORDING_STATE.IDLE];
  chrome.action.setBadgeText({ text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ color: cfg.color });
}

// ─── Offscreen Document ───────────────────────────────────────────────────────

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [OFFSCREEN_URL],
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url:           OFFSCREEN_URL,
    reasons:       [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Gravar áudio da aba + microfone via tabCapture para transcrição médica.',
  });
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

function messageOffscreen(type, payload = {}) {
  return chrome.runtime.sendMessage({ target: 'offscreen', type, ...payload });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleStart({ sessionId, tabId, micGranted = false }) {
  const state = await getState();
  if (state.status !== RECORDING_STATE.IDLE) {
    return { ok: false, error: 'Já existe uma gravação ativa.' };
  }

  let streamId;
  try {
    streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(id);
      });
    });
  } catch (err) {
    await setState({ status: RECORDING_STATE.ERROR, error: err.message });
    return { ok: false, error: err.message };
  }

  await ensureOffscreenDocument();
  await setState({
    status:    RECORDING_STATE.RECORDING,
    sessionId,
    startedAt: Date.now(),
    tabId,
    error:     null,
  });

  chrome.alarms.create('recordingTick', { periodInMinutes: 1 / 60 });
  console.log("[Lexie bg] micGranted=", micGranted);
  messageOffscreen(MSG.OFFSCREEN_START, { streamId, sessionId, micGranted });
  return { ok: true };
}

async function handleStop() {
  const state = await getState();
  if (state.status !== RECORDING_STATE.RECORDING) {
    return { ok: false, error: 'Nenhuma gravação ativa.' };
  }
  chrome.alarms.clear('recordingTick');
  await setState({ status: RECORDING_STATE.UPLOADING });
  messageOffscreen(MSG.OFFSCREEN_STOP);
  return { ok: true };
}

// Volta ao IDLE sem gravar — usado pelo botão "Nova Gravação"
async function handleReset() {
  chrome.alarms.clear('recordingTick');
  await closeOffscreenDocument();
  await setState({
    status:     RECORDING_STATE.IDLE,
    sessionId:  null,
    startedAt:  null,
    tabId:      null,
    elapsedSec: 0,
    error:      null,
  });
  return { ok: true };
}

// ─── Listener ────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target === 'offscreen') return false;

  (async () => {
    switch (message.type) {
      case MSG.START:        sendResponse(await handleStart(message)); break;
      case MSG.STOP:         sendResponse(await handleStop());         break;
      case MSG.STATUS:       sendResponse(await getState());           break;
      case MSG.RESET:        sendResponse(await handleReset());        break;

      case MSG.UPLOAD_DONE:
        await setState({ status: RECORDING_STATE.DONE });
        await closeOffscreenDocument();
        // Não volta ao IDLE automaticamente — usuário clica em "Nova Gravação"
        break;

      case MSG.UPLOAD_ERROR:
        await setState({ status: RECORDING_STATE.ERROR, error: message.error });
        await closeOffscreenDocument();
        break;

      default:
        sendResponse({ ok: false, error: `Tipo desconhecido: ${message.type}` });
    }
  })();

  return true;
});

// ─── Alarm tick ───────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'recordingTick') return;
  const state = await getState();
  if (state.status === RECORDING_STATE.RECORDING) {
    const elapsedSec = Math.round((Date.now() - state.startedAt) / 1000);
    await chrome.storage.session.set({ recordingState: { ...state, elapsedSec } });
  }
});

getState().then(state => updateBadge(state.status));
