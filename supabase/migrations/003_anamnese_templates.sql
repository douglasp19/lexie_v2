-- @route supabase/migrations/003_anamnese_templates.sql
-- Modelos de anamnese criados pelo nutricionista

create table anamnesis_templates (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    text        not null,
  title      text        not null,
  content    text        not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_anamnesis_templates_user_id on anamnesis_templates(user_id);

create trigger anamnesis_templates_updated_at
  before update on anamnesis_templates
  for each row execute function update_updated_at();

alter table anamnesis_templates enable row level security;