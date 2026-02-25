-- @route supabase/migrations/001_initial_schema.sql
-- Lexie — Schema inicial
-- Onde rodar: Supabase Dashboard → SQL Editor → Run All

-- ─── Extensões ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── sessions ─────────────────────────────────────────────────────────────────
create table sessions (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       text        not null,
  patient_name  text        not null,
  session_type  text        not null default 'online',  -- 'online' | 'presencial'
  notes         text,
  anchor_words  text[]      not null default '{}',
  status        text        not null default 'draft',
                            -- draft | processing | done | error
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── audio_uploads ────────────────────────────────────────────────────────────
create table audio_uploads (
  id            uuid        primary key default uuid_generate_v4(),
  session_id    uuid        not null references sessions(id) on delete cascade,
  upload_id     text        not null unique,
  storage_path  text,
  mime_type     text,
  size_bytes    bigint,
  transcription text,
  status        text        not null default 'pending',
                            -- pending | uploading | transcribed | deleted | error
  expires_at    timestamptz not null,   -- +24h após criação, limpo pelo cron
  created_at    timestamptz not null default now()
);

-- ─── reports ──────────────────────────────────────────────────────────────────
create table reports (
  id            uuid        primary key default uuid_generate_v4(),
  session_id    uuid        not null references sessions(id) on delete cascade,
  content       jsonb       not null default '{}',
  -- content: { queixa, historico, dados, metas, proximos_passos }
  ai_model      text        not null default 'llama-3.3-70b-versatile',
  generated_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
create index idx_sessions_user_id    on sessions(user_id);
create index idx_sessions_status     on sessions(status);
create index idx_audio_session_id    on audio_uploads(session_id);
create index idx_audio_expires_at    on audio_uploads(expires_at);
create index idx_reports_session_id  on reports(session_id);

-- ─── Trigger: updated_at automático ──────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

create trigger reports_updated_at
  before update on reports
  for each row execute function update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table sessions      enable row level security;
alter table audio_uploads enable row level security;
alter table reports        enable row level security;
-- As API Routes usam SUPABASE_SERVICE_ROLE_KEY que bypassa RLS.

-- ─── Storage bucket: audio-temp ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio-temp',
  'audio-temp',
  false,
  209715200,   -- 200 MB
  array['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mp4', 'application/octet-stream']
)
on conflict (id) do nothing;
