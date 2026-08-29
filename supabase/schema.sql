-- Koll. Apply with: bash supabase/apply.sh
--
-- Prefixed because this project shares a Supabase project with Lugn, whose own
-- `rapporter` table has a completely different shape. `create table if not
-- exists rapporter` silently does nothing there, and every insert then fails on
-- a missing column.
--
-- RLS is on with zero policies: the server's secret key is the only way in.

create table if not exists koll_rapporter (
  id uuid primary key default gen_random_uuid(),
  skapad timestamptz not null default now(),
  url text not null,
  namn text not null,
  rapport jsonb not null,
  bevakas boolean not null default false,
  betald boolean not null default false
);

create index if not exists koll_rapporter_skapad_idx on koll_rapporter (skapad desc);
create index if not exists koll_rapporter_bevakas_idx on koll_rapporter (bevakas) where bevakas;

create table if not exists koll_forandringar (
  id uuid primary key default gen_random_uuid(),
  rapport_id uuid not null references koll_rapporter (id) on delete cascade,
  konkurrent text not null,
  url text not null,
  typ text not null,
  vad text not null,
  upptackt timestamptz not null default now()
);

create index if not exists koll_forandringar_rapport_idx
  on koll_forandringar (rapport_id, upptackt desc);

alter table koll_rapporter enable row level security;
alter table koll_forandringar enable row level security;

-- Created through the Management API rather than the dashboard, these tables do
-- not inherit the default privileges, and the sb_secret_… key (service_role)
-- gets "permission denied" without this.
grant all on table koll_rapporter to service_role;
grant all on table koll_forandringar to service_role;

-- ---------------------------------------------------------------------------
-- Körningar. A run gets its row the moment it starts, so the URL is shareable
-- while the agent is still working rather than only after it finished.
--
-- The id is minted by the server, not by the database, and the finished report
-- is later inserted into koll_rapporter under that same id: /r/<id> is one
-- address for the whole life of an analysis, handed out before there is
-- anything to show.
-- ---------------------------------------------------------------------------

create table if not exists koll_korningar (
  id uuid primary key,
  skapad timestamptz not null default now(),
  -- The heartbeat. A run whose function was killed mid-way stops touching this,
  -- which is the only way a reader can tell "still working" from "gone".
  andrad timestamptz not null default now(),
  url text not null,
  namn text,
  status text not null default 'kor', -- kor | klar | fel
  fel text,
  -- What the working view draws, not the raw event log: the events carry whole
  -- competitor objects the progress view never shows and the finished report
  -- already stores.
  arbete jsonb not null default '{}'::jsonb
);

create index if not exists koll_korningar_status_idx
  on koll_korningar (status, andrad desc) where status = 'kor';

alter table koll_korningar enable row level security;

grant all on table koll_korningar to service_role;
