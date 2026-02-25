-- @route supabase/migrations/002_patients.sql

create table patients (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,                     -- Clerk user_id do nutricionista
  name         text not null,
  email        text,
  phone        text,
  birth_date   date,
  anamnesis    text,                               -- Histórico clínico fixo
  goals        text,                               -- Objetivos gerais
  notes        text,                               -- Anotações livres
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_patients_user_id on patients(user_id);
create index idx_patients_name    on patients(user_id, name);

-- Trigger updated_at
create trigger patients_updated_at
  before update on patients
  for each row execute function update_updated_at();

-- RLS
alter table patients enable row level security;

-- Adiciona coluna patient_id nas sessions (opcional — liga session ao paciente)
alter table sessions add column if not exists patient_id uuid references patients(id) on delete set null;
create index idx_sessions_patient_id on sessions(patient_id);