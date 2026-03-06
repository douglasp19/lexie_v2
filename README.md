# Lexie v2

> Micro SaaS para nutricionistas — transcrição automática de consultas e geração de relatórios clínicos com IA.

---

## O que é a Lexie?

A **Lexie** é uma plataforma que ajuda nutricionistas a gerarem relatórios de consulta de forma rápida e precisa, combinando três fontes de informação:

1. **Anotações do profissional** — registradas diretamente na plataforma durante ou após a consulta, com suporte a modelos de anamnese reutilizáveis.
2. **Palavras-âncora** — termos-chave que guiam a IA na geração do resumo (ex: `resistência insulínica`, `low-carb`, `glúten`).
3. **Transcrição do áudio** — enviada automaticamente pela extensão Chrome ao encerrar uma teleconsulta, ou via upload manual de arquivo de áudio.

O resultado é um relatório estruturado, editável e com timestamps de transcrição — gerado em aproximadamente 30 segundos.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (TypeScript, App Router) |
| Autenticação | Clerk |
| Banco de dados | Neon (PostgreSQL serverless) |
| Storage de áudio | Vercel Blob (acesso privado) |
| Transcrição | Groq Whisper (`whisper-large-v3-turbo`) |
| Geração de relatório | Groq LLM (`llama-3.3-70b`) |
| Extensão | Chrome Extension (Manifest V3) |
| Deploy | Vercel |
| Monorepo | npm workspaces |

---

## Estrutura do Repositório

```
lexie_v2/
├── apps/
│   ├── web/                    # Aplicação Next.js
│   │   ├── app/
│   │   │   ├── (platform)/     # Rotas autenticadas
│   │   │   │   ├── dashboard/
│   │   │   │   ├── session/[id]/
│   │   │   │   ├── patients/
│   │   │   │   ├── onboarding/ # Guia de instalação da extensão
│   │   │   │   └── guia/       # Documentação de uso
│   │   │   └── api/
│   │   │       ├── audio/      # upload-init, upload-chunk, upload-finalize, status, retry, cancel
│   │   │       ├── report/     # GET, PATCH, generate
│   │   │       ├── session/
│   │   │       ├── patients/
│   │   │       ├── templates/
│   │   │       └── webhooks/cleanup/
│   │   ├── lib/
│   │   │   ├── db/
│   │   │   │   ├── client.ts         # Neon SQL client
│   │   │   │   └── queries/          # sessions, reports, patients, audio
│   │   │   ├── storage/
│   │   │   │   └── audio.ts          # Vercel Blob (upload/download/delete)
│   │   │   └── ai/
│   │   │       ├── transcribe.ts     # Whisper via Groq
│   │   │       └── prompts.ts
│   │   └── public/
│   │       └── extension/
│   │           └── extensao_lexie.zip
│   └── extension/              # Extensão Chrome (MV3)
├── .env.example
├── vercel.json
└── neon_schema.sql             # Schema completo do banco
```

---

## Filosofia do Projeto

### 💸 Custo Zero até ~100 usuários

| Serviço | Tier | Limite |
|---|---|---|
| Neon | Free | 10 GB, sem pausa automática |
| Vercel Blob | Free | 1 GB storage |
| Vercel Hosting | Free | 100 GB bandwidth |
| Clerk | Free | até 10.000 MAU |
| Groq | Free | 7.200s de áudio/hora |

**Custo fixo mensal: R$0**

### 🔒 Baixa Retenção de Dados
Arquivos de áudio são armazenados com **acesso privado** no Vercel Blob e deletados automaticamente após **24 horas**. Apenas a transcrição em texto é mantida, vinculada à sessão.

### 🎙 Otimização de Áudio
A extensão grava em **32 kbps** (WebM/Opus), reduzindo o tamanho 75% em relação ao padrão — 1 hora de áudio ≈ 14 MB.

---

## Fluxo Principal

```
Consulta (presencial ou online)
        ↓
Nutricionista cria sessão + anota + define palavras-âncora
        ↓
Áudio capturado via extensão Chrome (teleconsulta)
   ou upload manual de arquivo de áudio
        ↓
Upload em chunks → montagem → transcrição Whisper (Groq)
Timestamps por segmento salvos junto à transcrição
        ↓
Áudio deletado do storage após transcrição
        ↓
IA combina: anotações + âncoras + transcrição completa
        ↓
Relatório gerado, editável por seção, exportável
```

---

## Funcionalidades

### Consultas
- Criação com tipo (presencial/online) e vínculo opcional a paciente
- Upload em chunks de 5 MB com barra de progresso
- Cancelamento de upload com limpeza do storage e banco
- Substituição de arquivo após cancelamento
- Retry de transcrição em caso de erro
- Transcrição com timestamps por segmento (visualização MM:SS)
- Auto-save de anotações (debounce 900ms)
- Modelos de anamnese: criar, editar, deletar, aplicar

### Pacientes
- CRUD completo (nome, email, telefone, data de nascimento)
- Histórico de consultas por paciente
- Busca por nome em tempo real

### Relatório
- Geração via IA (transcrição + anotações + palavras-âncora)
- Edição inline por seção com auto-save
- Visualização da transcrição completa com timestamps

### Extensão Chrome
- Captura áudio do sistema via tabCapture API
- Gravação em 32 kbps (WebM/Opus)
- Upload automático ao encerrar gravação
- Vínculo por ID de sessão

### Plataforma
- Onboarding com instalação passo a passo da extensão
- Download da extensão direto da plataforma (`/public/extension/`)
- Detecção automática da extensão via postMessage
- Banner na dashboard para usuários sem extensão
- Guia completo de uso em `/guia`

---

## Extensão do Navegador

| Navegador | Suporte |
|---|---|
| Google Chrome | ✅ Completo (tabCapture API) |
| Microsoft Edge | ✅ Completo (tabCapture API) |
| Firefox | ⚠️ Não suportado (tabCapture indisponível no MV3) |

A extensão não está publicada na Chrome Web Store — instalação via modo desenvolvedor. Veja `/onboarding` na plataforma.

---

## Variáveis de Ambiente

```env
# Neon (Pooled connection)
DATABASE_URL=postgresql://user:senha@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Groq
GROQ_API_KEY=gsk_...

# App
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
CRON_SECRET=seu-secret-para-o-cron
```

> **Importante:** não use aspas nos valores do `.env.local`.

---

## Como rodar localmente

```bash
# 1. Instalar dependências
cd apps/web
npm install

# 2. Configurar variáveis
cp ../../.env.example .env.local
# Edite .env.local com suas chaves

# 3. Criar banco no Neon
# neon.tech → New Project → SQL Editor → executar neon_schema.sql

# 4. Vincular ao Vercel (para o Blob funcionar localmente)
npx vercel link
npx vercel env pull .env.local

# 5. Rodar
npm run dev
```

---

## Schema do Banco

```sql
patients              -- cadastro de pacientes
sessions              -- consultas (draft → processing → done)
audio_uploads         -- upload/transcrição (transcription_segments JSONB)
reports               -- relatórios gerados (content JSONB)
anamnesis_templates   -- modelos de anamnese por usuário
```

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

## Roadmap

- [x] Dashboard com estatísticas
- [x] CRUD de sessões e pacientes
- [x] Upload em chunks com retry e cancelamento
- [x] Transcrição Whisper com timestamps (Groq)
- [x] Geração de relatório com IA
- [x] Extensão Chrome MV3 (32 kbps)
- [x] Modelos de anamnese
- [x] Migração Supabase → Neon + Vercel Blob
- [x] Onboarding + guia de uso
- [ ] Exportação PDF
- [ ] Gateway de pagamento
- [ ] Cron de limpeza de áudios expirados
- [ ] Publicação na Chrome Web Store

---

*Feito com 🌿 para nutricionistas que valorizam o tempo com seus pacientes.*