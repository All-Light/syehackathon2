-- Koll. Run this once in the Supabase SQL editor.
-- RLS is on with zero policies: the server's secret key is the only way in.

create table if not exists rapporter (
  id uuid primary key default gen_random_uuid(),
  skapad timestamptz not null default now(),
  url text not null,
  namn text not null,
  rapport jsonb not null,
  bevakas boolean not null default false,
  betald boolean not null default false
);

create index if not exists rapporter_skapad_idx on rapporter (skapad desc);
create index if not exists rapporter_bevakas_idx on rapporter (bevakas) where bevakas;

create table if not exists forandringar (
  id uuid primary key default gen_random_uuid(),
  rapport_id uuid not null references rapporter (id) on delete cascade,
  konkurrent text not null,
  url text not null,
  typ text not null,
  vad text not null,
  upptackt timestamptz not null default now()
);

create index if not exists forandringar_rapport_idx on forandringar (rapport_id, upptackt desc);

alter table rapporter enable row level security;
alter table forandringar enable row level security;
