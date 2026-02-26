# Lexie v2

> Micro SaaS para nutricionistas — geração inteligente de resumos de consulta com IA.

---

## O que é a Lexie?

A **Lexie** é uma plataforma que ajuda nutricionistas a gerarem relatórios de consulta de forma rápida e precisa, combinando três fontes de informação:

1. **Anotações do profissional** — registradas diretamente na plataforma durante ou após a consulta.
2. **Palavras-âncora** — termos-chave definidos pelo nutricionista que guiam a IA na geração do resumo (ex: `resistência insulínica`, `low-carb`, `glúten`).
3. **Transcrição do áudio** — enviada automaticamente pela extensão do navegador ao encerrar uma reunião, ou por upload manual de arquivo de áudio.

O resultado é um relatório estruturado, editável e exportável em PDF — gerado em aproximadamente 3 minutos.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (TypeScript) |
| Backend / BaaS | Supabase (Auth, Database, Storage) |
| IA / Transcrição | Whisper (áudio → texto) + LLM para geração do relatório |
| Extensão | Chrome Extension (Manifest V3) + compatibilidade Firefox/Edge |
| Deploy | Vercel |
| Monorepo | npm workspaces |

---

## Estrutura do Repositório

```
lexie_v2/
├── apps/
│   ├── web/          # Aplicação Next.js (plataforma principal)
│   └── extension/    # Extensão do navegador (Chrome/Firefox/Edge)
├── packages/
│   └── types/        # Tipos TypeScript compartilhados entre apps
├── supabase/
│   └── migrations/   # Migrações do banco de dados
├── .env.example      # Variáveis de ambiente necessárias
├── vercel.json       # Configuração de deploy
└── package-lock.json
```

---

## Filosofia do Projeto

### 💸 Custo Zero no início
Todas as escolhas de infraestrutura priorizam o tier gratuito das plataformas. O objetivo é validar o produto sem custos operacionais.

### 🔒 Baixa Retenção de Dados
Arquivos de áudio enviados à plataforma são deletados do servidor após **24 horas**. Apenas a transcrição processada é armazenada, vinculada à sessão.

---

## Fluxo Principal

```
Consulta (presencial ou online)
    ↓
Nutricionista anota + define palavras-âncora na Lexie
    ↓
Áudio capturado pela extensão (Meet/Zoom) ou upload manual
    ↓
Áudio transcrito (Whisper)
    ↓
IA combina: anotações + âncoras + transcrição
    ↓
Relatório gerado, editável e exportável em PDF
```

---

## Extensão do Navegador

A extensão captura o áudio das reuniões online (Google Meet, Zoom, etc.) e envia automaticamente para a sessão correspondente na Lexie ao encerrar a gravação.

| Navegador | Suporte |
|---|---|
| Google Chrome | ✅ Completo (tabCapture API) |
| Microsoft Edge | ✅ Completo (tabCapture API) |
| Firefox | ⚡ Funcional via `getDisplayMedia` (requer confirmação extra do usuário) |

---

## Variáveis de Ambiente

Consulte o arquivo `.env.example` na raiz do projeto para ver todas as variáveis necessárias.

---

## Design System

| Token | Valor |
|---|---|
| Verde principal | `#4CAF50` |
| Verde oliva | `#6B8E23` |
| Laranja | `#F4A261` |
| Dourado | `#E9C46A` |
| Fonte principal | DM Sans |
| Fonte display | Playfair Display |
| Fonte mono | DM Mono |

---

## Roadmap (v2)

- [x] Protótipo de interface (Dashboard, Consulta, Relatório, Extensão)
- [ ] Autenticação com Supabase Auth
- [ ] CRUD de sessões
- [ ] Upload e transcrição de áudio (Whisper)
- [ ] Geração de relatório com IA
- [ ] Extensão Chrome (Manifest V3)
- [ ] Exportação PDF
- [ ] Suporte Firefox/Edge na extensão

---

## Como rodar localmente

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env.local

# Rodar a aplicação web
npm run dev --workspace=apps/web
```

---

*Feito com 🌿 para nutricionistas que valorizam o tempo com seus pacientes.*