// @route apps/extension/mic-permission.js

const btn    = document.getElementById('btn-allow');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.disabled    = true;
  btn.textContent = '⏳ Aguardando…';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach(t => t.stop());

    status.textContent = '✓ Microfone autorizado! Fechando…';
    status.className   = 'status ok';

    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_RESULT', granted: true });

    setTimeout(() => window.close(), 800);

  } catch (err) {
    const denied = err.name === 'NotAllowedError';

    status.textContent = denied
      ? '⚠ Permissão negada. Clique no cadeado na barra do Chrome para resetar.'
      : `⚠ Erro: ${err.message}`;
    status.className = 'status denied';

    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_RESULT', granted: false, error: err.name });

    btn.disabled    = false;
    btn.textContent = 'Tentar novamente';
  }
});

// Se já tem permissão, dispara automaticamente sem mostrar diálogo
navigator.permissions.query({ name: 'microphone' }).then(result => {
  if (result.state === 'granted') btn.click();
}).catch(() => {});
