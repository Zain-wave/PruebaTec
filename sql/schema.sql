-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- Idempotente: se puede correr más de una vez.

-- 1) Registros consolidados (esquema común Excel + PDF)
create table if not exists records (
  id                bigserial primary key,
  row_key           text not null unique,          -- clave por CONTENIDO: evita registros duplicados
  fecha             date,
  cliente           text,
  referencia        text,                           -- solo viene en el PDF
  categoria         text,
  cantidad          numeric,                        -- solo viene en el Excel
  valor             numeric,
  estado            text,
  source_type       text not null check (source_type in ('excel','pdf')),
  source_file       text,
  email_message_id  text,
  email_received_at timestamptz,
  quality_flag      text not null default 'ok' check (quality_flag in ('ok','warning','error')),
  quality_note      text,
  ingested_at       timestamptz not null default now()
);
create index if not exists records_fecha_idx on records (fecha);

-- 2) Historial de archivos recibidos (un archivo = un mensaje + un nombre)
create table if not exists processed_files (
  id           bigserial primary key,
  message_id   text not null,
  filename     text not null,
  source_type  text,
  sender       text,
  subject      text,
  processed_at timestamptz not null default now(),
  unique (message_id, filename)
);

-- 3) Resúmenes generados por IA (Gemini) o por plantilla si la API falla
create table if not exists ai_summaries (
  id             bigserial primary key,
  generated_at   timestamptz not null default now(),
  period_from    date,
  period_to      date,
  total_records  int,
  valor_total    numeric,
  summary        text not null,
  model          text,
  used_fallback  boolean not null default false
);

-- 4) Inconsistencias semánticas detectadas por IA (lo que las reglas no cubren)
create table if not exists ai_flags (
  id           bigserial primary key,
  row_key      text not null,
  motivo       text not null,
  severidad    text,
  model        text,
  generated_at timestamptz not null default now(),
  unique (row_key, motivo)
);

-- Seguridad: RLS activo. El dashboard usa la clave "anon" (solo lectura).
-- n8n usa la clave "service_role", que se salta RLS para escribir. Nunca pongas esa clave en el front.
alter table records         enable row level security;
alter table processed_files enable row level security;
alter table ai_summaries    enable row level security;
alter table ai_flags        enable row level security;

drop policy if exists "anon read records"   on records;
drop policy if exists "anon read files"     on processed_files;
drop policy if exists "anon read summaries" on ai_summaries;
drop policy if exists "anon read flags"     on ai_flags;
create policy "anon read records"   on records         for select to anon using (true);
create policy "anon read files"     on processed_files for select to anon using (true);
create policy "anon read summaries" on ai_summaries    for select to anon using (true);
create policy "anon read flags"     on ai_flags        for select to anon using (true);

-- 5) Integridad de ai_flags: la IA no puede guardar un row_key que no exista en records.
--    (El workflow 2 además lo valida en código antes de insertar.)
delete from ai_flags f where not exists (select 1 from records r where r.row_key = f.row_key);
alter table ai_flags drop constraint if exists ai_flags_row_key_fkey;
alter table ai_flags add constraint ai_flags_row_key_fkey
  foreign key (row_key) references records (row_key) on delete cascade;
