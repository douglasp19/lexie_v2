# Lexie — Extensão Chrome / Edge

Extensão **Manifest V3** que captura o áudio de abas de videoconferência
(Google Meet, Zoom, Teams…) e envia de forma segura para a plataforma Lexie
processar e gerar o relatório de consulta.

---

## Estrutura de arquivos

```
lexie-extension/
├── manifest.json       # Configuração da extensão (MV3)
├── background.js       # Service worker — orquestra tudo
├── offscreen.html      # Shell invisível para o MediaRecorder
├── offscreen.js        # Grava áudio + faz upload chunked
├── popup.html          # Interface visual do popup
├── popup.js            # Lógica da UI do popup
├── constants.js        # Constantes compartilhadas
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Como instalar (desenvolvimento)

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative **"Modo do desenvolvedor"** (canto superior direito).
3. Clique em **"Carregar sem compactação"**.
4. Selecione a pasta `lexie-extension/`.
5. O ícone da Lexie aparecerá na barra de ferramentas.

---

## Fluxo técnico

```
Popup
 │─── MSG.START ──────────────────► Background (SW)
 │                                    │
 │                                    ├─ tabCapture.getMediaStreamId(tabId)
 │                                    ├─ offscreen.createDocument()
 │                                    └─ MSG.OFFSCREEN_START(streamId) ──► Offscreen
 │                                                                           │
 │                                                                           ├─ getUserMedia({ tabCapture streamId })
 │                                                                           └─ MediaRecorder.start()
 │
 │─── MSG.STOP ───────────────────► Background
 │                                    └─ MSG.OFFSCREEN_STOP ────────────► Offscreen
 │                                                                           │
 │                                                                           ├─ MediaRecorder.stop()
 │                                                                           ├─ uploadChunked(blob, sessionId)
 │                                                                           │    POST /api/audio/upload-init
 │                                                                           │    POST /api/audio/upload-chunk  (N vezes)
 │                                                                           │    POST /api/audio/upload-finalize
 │                                                                           └─ MSG.UPLOAD_DONE ──────────────► Background
 │                                                                                                               └─ setState(DONE)
 │◄─── STATUS poll (1s) ──────────── Background
```

---

## Endpoints esperados no backend

| Método | Rota | Body / Headers |
|--------|------|----------------|
| POST | `/api/audio/upload-init` | `{ sessionId, mimeType, totalBytes, capturedAt }` |
| POST | `/api/audio/upload-chunk` | FormData `chunk` + headers `X-Session-Id`, `X-Upload-Id`, `X-Chunk-Index`, `X-Total-Chunks` |
| POST | `/api/audio/upload-finalize` | `{ sessionId, uploadId }` |

---

## Suporte a navegadores

| Navegador | API usada | Status |
|-----------|-----------|--------|
| Chrome ≥ 116 | `tabCapture.getMediaStreamId` + Offscreen Document | ✅ Completo |
| Edge ≥ 116 | Mesmo que Chrome (Chromium) | ✅ Completo |
| Firefox | `getDisplayMedia` (ver nota abaixo) | ⚡ Funcional* |
| Safari | Não suporta tabCapture | ❌ Não suportado |

### Firefox
Firefox não tem `chrome.tabCapture` nem Offscreen Document. Para suportá-lo:
- Usar `browser.tabs.captureTab()` (API exclusiva do Firefox) **ou**
- Usar `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })` no popup
  e descartar a track de vídeo — exige um clique extra do usuário para confirmar.
- O Firefox usa a API `browser.*` em vez de `chrome.*`.
  Use a biblioteca [webextension-polyfill](https://github.com/mozilla/webextension-polyfill)
  para compatibilidade cruzada.

---

## Gerar ícones

Você precisa de 3 PNGs na pasta `icons/`. Gere a partir de qualquer imagem:

```bash
# Com ImageMagick:
convert logo.png -resize 16x16   icons/icon16.png
convert logo.png -resize 48x48   icons/icon48.png
convert logo.png -resize 128x128 icons/icon128.png
```

---

## Publicar na Chrome Web Store

1. Zipar a pasta: `zip -r lexie-extension.zip lexie-extension/`
2. Acessar [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pagar taxa única de $5 USD (uma vez por conta)
4. Enviar o `.zip` — revisão leva geralmente 1–3 dias úteis

---

## Segurança e LGPD

- Áudio transmitido com **TLS** (HTTPS obrigatório)
- Áudio **não persistido localmente** — vai direto para upload
- Backend deve deletar o arquivo de áudio em **24h** após transcrição
- Nenhum dado de paciente é armazenado na extensão
- `storage.local` guarda apenas o último `sessionId` digitado (sem dados de saúde)
