// @route apps/extension/popup.js

const RECORDING_STATE = {
  IDLE:      'idle',
  RECORDING: 'recording',
  UPLOADING: 'uploading',
  DONE:      'done',
  ERROR:     'error',
};

const MSG = {
  START:  'START',
  STOP:   'STOP',
  STATUS: 'STATUS',
  RESET:  'RESET',
};

// ─── DOM ─────────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const els = {
  badge:         $('status-badge'),
  sessionInput:  $('session-id-input'),
  tabSelect:     $('tab-select'),
  timerDisplay:  $('timer-display'),
  timerPlatform: $('timer-platform'),
  progressPct:   $('progress-pct'),
  progressFill:  $('progress-fill'),
  doneSub:       $('done-sub'),
  errorMsg:      $('error-msg'),
  openPlatform:  $('open-platform-link'),
  testBadge:     $('test-badge'),
  btnStart:      $('btn-start'),
  btnStop:       $('btn-stop'),
  btnReset:      $('btn-reset'),
};

// ─── Comunicação ──────────────────────────────────────────────────────────────

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, response => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

// ─── Renderização ─────────────────────────────────────────────────────────────

const ALL_SECTIONS = [
  'section-setup', 'section-tab', 'section-timer',
  'section-progress', 'section-done', 'section-error',
];

function show(...ids) {
  ALL_SECTIONS.forEach(id => $(id).classList.add('hidden'));
  ids.forEach(id => $(id).classList.remove('hidden'));
}

function showBtns(start, stop, reset) {
  els.btnStart.classList.toggle('hidden', !start);
  els.btnStop .classList.toggle('hidden', !stop);
  els.btnReset.classList.toggle('hidden', !reset);
  els.btnStart.disabled = false;
  els.btnStop .disabled = false;
  els.btnReset.disabled = false;
}

const BADGE_MAP = {
  [RECORDING_STATE.IDLE]:      { text: 'Parado',     cls: 'badge-idle'      },
  [RECORDING_STATE.RECORDING]: { text: '● Gravando', cls: 'badge-recording' },
  [RECORDING_STATE.UPLOADING]: { text: 'Salvando',   cls: 'badge-uploading' },
  [RECORDING_STATE.DONE]:      { text: '✓ Salvo',    cls: 'badge-done'      },
  [RECORDING_STATE.ERROR]:     { text: '⚠ Erro',     cls: 'badge-error'     },
};

function renderBadge(status) {
  const cfg = BADGE_MAP[status] ?? BADGE_MAP[RECORDING_STATE.IDLE];
  els.badge.textContent = cfg.text;
  els.badge.className   = `status-badge ${cfg.cls}`;
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderState(state) {
  renderBadge(state.status);

  if (state.sessionId) {
    els.openPlatform.href = `https://assistentelexie.vercel.app/session/${state.sessionId}`;
  }

  switch (state.status) {
    case RECORDING_STATE.IDLE:
      show('section-setup', 'section-tab');
      showBtns(true, false, false);
      break;

    case RECORDING_STATE.RECORDING:
      show('section-timer');
      showBtns(false, true, false);
      els.timerDisplay.textContent = fmtTime(state.elapsedSec ?? 0);
      detectPlatformName(state.tabId);
      break;

    case RECORDING_STATE.UPLOADING:
      show('section-progress');
      showBtns(false, false, false);
      break;

    case RECORDING_STATE.DONE:
      show('section-done');
      showBtns(false, false, true);   // ← "Nova Gravação" habilitado
      if (state.sessionId) {
        els.doneSub.textContent = state.testMode
          ? `Arquivo .webm baixado! Sessão: ${state.sessionId}`
          : `Sessão ${state.sessionId} — transcrição em andamento…`;
      }
      break;

    case RECORDING_STATE.ERROR:
      show('section-error');
      showBtns(false, false, true);   // ← "Nova Gravação" habilitado
      els.errorMsg.textContent = state.error ?? 'Erro desconhecido.';
      break;
  }
}

async function detectPlatformName(tabId) {
  if (!tabId) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url ?? '';
    let name = 'Consulta Online';
    if (url.includes('meet.google.com'))      name = 'Google Meet';
    else if (url.includes('zoom.us'))         name = 'Zoom';
    else if (url.includes('teams.microsoft')) name = 'Teams';
    els.timerPlatform.textContent = name;
  } catch (_) { /* aba pode ter sido fechada */ }
}

// ─── Lista de abas ────────────────────────────────────────────────────────────

async function populateTabs() {
  const priority = ['meet.google.com', 'zoom.us', 'teams.microsoft', 'whereby.com'];
  let tabs = await chrome.tabs.query({ currentWindow: true });
  tabs.sort((a, b) => {
    const ai = priority.findIndex(p => (a.url ?? '').includes(p));
    const bi = priority.findIndex(p => (b.url ?? '').includes(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const truncate = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;
  els.tabSelect.innerHTML = tabs.map(t =>
    `<option value="${t.id}">${truncate(t.title ?? t.url ?? 'Aba sem título', 38)}</option>`
  ).join('');
}

// ─── Permissão de microfone ───────────────────────────────────────────────────
//
// Problema: quando getUserMedia é chamado no popup, o Chrome abre o diálogo,
// o popup perde foco e FECHA — cancelando a requisição com NotAllowedError.
//
// Solução em 3 casos via permissions.query():
//   'granted' → getUserMedia silencioso, sem diálogo ✅
//   'denied'  → mostrar instrução para resetar no Chrome
//   'prompt'  → abrir mic-permission.html em janela separada (não fecha sozinha)

async function checkMicStatus() {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    return result.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'prompt';
  }
}

function openMicPermissionWindow() {
  return new Promise((resolve) => {
    chrome.windows.create({
      url:     chrome.runtime.getURL('mic-permission.html'),
      type:    'popup',
      width:   420,
      height:  340,
      focused: true,
    });

    function onMessage(message) {
      if (message.type !== 'MIC_PERMISSION_RESULT') return;
      chrome.runtime.onMessage.removeListener(onMessage);
      resolve(message.granted);
    }
    chrome.runtime.onMessage.addListener(onMessage);

    // Timeout: usuário fechou a janela sem responder
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(onMessage);
      resolve(false);
    }, 60_000);
  });
}

async function ensureMicPermission() {
  const status = await checkMicStatus();
  console.log('[Lexie popup] Mic permission status:', status);

  if (status === 'granted') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(t => t.stop());
      console.log('[Lexie popup] ✅ Mic já autorizado, getUserMedia silencioso OK.');
      return { granted: true };
    } catch (err) {
      console.warn('[Lexie popup] status=granted mas getUserMedia falhou:', err.name);
      return { granted: false, error: err.name };
    }
  }

  if (status === 'denied') {
    console.warn('[Lexie popup] Mic negado anteriormente.');
    const el = document.getElementById('mic-denied-notice');
    if (el) el.classList.remove('hidden');
    return { granted: false, error: 'NotAllowedError' };
  }

  // 'prompt' → abre janela separada para pedir permissão sem fechar o popup
  console.log('[Lexie popup] Abrindo janela de permissão de mic…');
  const granted = await openMicPermissionWindow();
  console.log('[Lexie popup] Resultado da janela:', granted);
  return { granted };
}

// ─── Botões ───────────────────────────────────────────────────────────────────

els.btnStart.addEventListener('click', async () => {
  const sessionId = els.sessionInput.value.trim();
  if (!sessionId) {
    els.sessionInput.style.borderColor = '#E53E3E';
    els.sessionInput.focus();
    setTimeout(() => (els.sessionInput.style.borderColor = ''), 1500);
    return;
  }
  const tabId = Number(els.tabSelect.value);
  if (!tabId) { alert('Selecione uma aba para capturar.'); return; }

  els.btnStart.disabled    = true;
  els.btnStart.textContent = '🎤 Verificando mic…';

  const mic = await ensureMicPermission();

  if (!mic.granted) {
    console.warn('[Lexie popup] Mic indisponível:', mic.error, '→ gravando só a aba.');
  }

  els.btnStart.textContent = '⏳ Iniciando…';

  const res = await sendMessage(MSG.START, { sessionId, tabId, micGranted: mic.granted })
    .catch(err => ({ ok: false, error: err.message }));

  if (!res?.ok) {
    alert(`Erro ao iniciar: ${res?.error ?? 'desconhecido'}`);
    els.btnStart.disabled    = false;
    els.btnStart.textContent = '🎙 Iniciar Gravação';
    return;
  }
  await refresh();
});

els.btnStop.addEventListener('click', async () => {
  els.btnStop.disabled    = true;
  els.btnStop.textContent = '⏳ Parando…';

  const res = await sendMessage(MSG.STOP).catch(err => ({ ok: false, error: err.message }));
  if (!res?.ok) {
    alert(`Erro ao parar: ${res?.error}`);
    els.btnStop.disabled = false;
  } else {
    await refresh();
  }
});

// "Nova Gravação" — envia RESET e volta para o estado inicial
els.btnReset.addEventListener('click', async () => {
  els.btnReset.disabled    = true;
  els.btnReset.textContent = '⏳ Reiniciando…';
  await sendMessage(MSG.RESET).catch(() => {});
  // Atualiza lista de abas para o próximo uso
  await populateTabs();
  await refresh();
});

// ─── Progresso de upload ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'UPLOAD_PROGRESS') return;
  const pct = message.progress ?? 0;
  els.progressPct.textContent  = `${pct}%`;
  els.progressFill.style.width = `${pct}%`;
});

// ─── Polling ──────────────────────────────────────────────────────────────────

let pollInterval = null;

async function refresh() {
  const state = await sendMessage(MSG.STATUS).catch(() => ({ status: RECORDING_STATE.IDLE }));
  renderState(state);

  clearInterval(pollInterval);
  if ([RECORDING_STATE.RECORDING, RECORDING_STATE.UPLOADING].includes(state?.status)) {
    pollInterval = setInterval(refresh, 1000);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  // Mostra badge TEST MODE se aplicável
  // (lê de storage pra não precisar importar CONFIG aqui)
  chrome.storage.local.get('testMode', ({ testMode }) => {
    if (testMode !== false && els.testBadge) {
      els.testBadge.classList.remove('hidden');
    }
  });

  await populateTabs();
  await refresh();

  // Restaurar último sessionId
  const { lastSessionId } = await chrome.storage.local.get('lastSessionId');
  if (lastSessionId) els.sessionInput.value = lastSessionId;

  els.sessionInput.addEventListener('input', () => {
    chrome.storage.local.set({ lastSessionId: els.sessionInput.value.trim() });
  });
})();
