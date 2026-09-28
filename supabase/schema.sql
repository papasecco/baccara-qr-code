-- Schema per il sistema di conferme QR code
-- Esegui questo script nell'SQL editor di Supabase (Database > SQL Editor)

create extension if not exists "pgcrypto";

-- Un evento per ogni PR/typeform
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- es. "Serata Marco"
  typeform_form_id text not null unique, -- ID del form Typeform (es. "AbCdEf12")
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Ogni iscrizione generata da una risposta al typeform
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(), -- questo id è anche il token del QR code
  event_id uuid not null references events(id) on delete cascade,
  typeform_response_token text not null,  -- token della risposta typeform (evita doppioni)
  email text not null,
  full_name text,
  raw_answers jsonb,
  email_status text not null default 'pending', -- pending | sent | failed
  email_error text,
  status text not null default 'valid',          -- valid | scanned | void
  scanned_at timestamptz,
  scanned_by text,
  created_at timestamptz not null default now(),
  unique (event_id, typeform_response_token)
);

create index if not exists idx_registrations_event on registrations(event_id);
create index if not exists idx_registrations_status on registrations(status);

-- Vista comoda per la dashboard: conteggi per evento
create or replace view event_stats as
select
  e.id as event_id,
  e.name as event_name,
  e.is_active,
  count(r.id) as total_registered,
  count(r.id) filter (where r.status = 'scanned') as total_scanned,
  count(r.id) filter (where r.status = 'valid') as total_valid,
  count(r.id) filter (where r.status = 'void') as total_void
from events e
left join registrations r on r.event_id = e.id
group by e.id, e.name, e.is_active
order by e.name;

-- Abilita Realtime sulla tabella registrations (per la dashboard live)
alter publication supabase_realtime add table registrations;

-- Row Level Security: il client browser NON deve avere accesso diretto,
-- tutte le operazioni passano dal backend con la service role key.
alter table events enable row level security;
alter table registrations enable row level security;
-- Nessuna policy = nessun accesso da client anonimo/pubblico, solo la service role (server) può leggere/scrivere.
