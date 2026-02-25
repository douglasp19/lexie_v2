# Lexie Extension — Setup no Windows (PowerShell / VSCode)

## 1. Copiar os arquivos para dentro do projeto

Coloque a pasta `extension` baixada dentro de `lexie\apps\`:

```
lexie\
└── apps\
    └── extension\   ← pasta desta entrega
        ├── manifest.json
        ├── background.js
        ├── offscreen.html
        ├── offscreen.js
        ├── popup.html
        ├── popup.js
        ├── constants.js
        └── icons\
            ├── icon16.png
            ├── icon48.png
            └── icon128.png
```

---

## 2. Ajustar a URL da API (antes de testar)

Abra `constants.js` e troque a linha `API_BASE` pelo endereço correto:

```js
// Desenvolvimento local
API_BASE: 'http://localhost:3000/api',

// Produção
API_BASE: 'https://lexie.app/api',
```

---

## 3. Carregar a extensão no Chrome ou Edge

```powershell
# Abre o Chrome direto na página de extensões
Start-Process "chrome.exe" "chrome://extensions"

# Ou no Edge
Start-Process "msedge.exe" "edge://extensions"
```

Na página que abrir:
1. Ative **"Modo do desenvolvedor"** (toggle no canto superior direito)
2. Clique em **"Carregar sem compactação"**
3. Selecione a pasta `lexie\apps\extension`
4. O ícone da Lexie aparece na barra de ferramentas

---

## 4. Recarregar após editar arquivos

Toda vez que editar qualquer arquivo da extensão, clique em **↺ atualizar**
no card dela dentro de `chrome://extensions`.

Atalho rápido via PowerShell:

```powershell
# Abre a página de extensões para você clicar em atualizar
Start-Process "chrome.exe" "chrome://extensions"
```

> Não há hot-reload automático em extensões MV3. É necessário o clique manual.

---

## 5. Ver logs de erro (Service Worker)

Na página `chrome://extensions`, clique em **"Service Worker"** no card da Lexie.
Abre o DevTools do background — é onde aparecem erros do `background.js`.

Para ver os logs do `offscreen.js`, abra:
```
chrome://extensions → Detalhes → Visualizar páginas de plano de fundo
```

---

## 6. Gerar ícones personalizados (opcional)

Se quiser substituir os ícones placeholder pelos definitivos:

```powershell
# Requer ImageMagick instalado: https://imagemagick.org/script/download.php
magick logo.png -resize 16x16   lexie\apps\extension\icons\icon16.png
magick logo.png -resize 48x48   lexie\apps\extension\icons\icon48.png
magick logo.png -resize 128x128 lexie\apps\extension\icons\icon128.png
```

---

## 7. Empacotar para publicação (Chrome Web Store)

```powershell
# Comprime a pasta da extensão em .zip
Compress-Archive -Path "lexie\apps\extension\*" `
                 -DestinationPath "lexie-extension.zip" `
                 -Force

Write-Host "ZIP gerado: lexie-extension.zip" -ForegroundColor Green
```

Depois acesse [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
e envie o `.zip`. Taxa única de **$5 USD** por conta de desenvolvedor.
