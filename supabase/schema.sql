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

-- ---------------------------------------------------------------------------
-- E-post. The customer has no account: the report url is their whole identity,
-- which means we have no way to reach a person who closed the tab. An address
-- left on a report is the one thread back — and the only list this product
-- builds.
--
-- It sits on the report rather than in a table of its own because that is what
-- it is: a property of this report, not a subscription. Nothing is sent from
-- here; there is no mail provider configured.
--
-- No new grant: `grant all on table` above covers columns added later, and the
-- Management API's missing default privileges only bite on new *tables*.
-- ---------------------------------------------------------------------------

alter table koll_rapporter add column if not exists epost text;

-- Answers the only question ever asked of this column — "who has left us an
-- address, and on what" — without reading every report body.
create index if not exists koll_rapporter_epost_idx
  on koll_rapporter (epost) where epost is not null;

-- Where a change came from. A row backfilled from the Internet Archive cites a
-- dated capture, which a reader can open and check themselves — more checkable
-- than a live page, which has already moved on.
alter table koll_forandringar add column if not exists kalla text;
alter table koll_forandringar add column if not exists ursprung text default 'kontroll';

-- ---------------------------------------------------------------------------
-- Ägare. Real accounts (Supabase Auth, Google) arrive after the product has
-- been running without them, so ownership is bolted on rather than assumed.
--
-- Nullable, and it must stay nullable: every report made so far has no owner,
-- and the product's promise is still "the url is the account" — anyone holding
-- a link reads the report, signed in or not. This column only answers the extra
-- question an account makes possible: "which of these are mine?".
--
-- `on delete set null` rather than cascade: deleting an account must not delete
-- somebody's report. The link keeps working; it simply goes back to being
-- ownerless, exactly like every report from before this column existed.
--
-- It references auth.users, which lives in the Auth schema of this same
-- project. No grant needed — `grant all on table koll_rapporter` above already
-- covers columns added later; the Management API's missing default privileges
-- only bite on new *tables*.
--
-- Relationship to `epost` above: they are deliberately separate. `epost` is a
-- contact address typed into a report by someone with no account, and is never
-- evidence of identity — anyone can type any address. `anvandare` is the only
-- identity in this schema. A report can have one, the other, both or neither.
-- ---------------------------------------------------------------------------

alter table koll_rapporter
  add column if not exists anvandare uuid references auth.users (id) on delete set null;

-- "My reports, newest first" — the only query this column exists for. Partial,
-- because the overwhelming majority of rows are ownerless and would otherwise
-- bloat the index without ever being looked up through it.
create index if not exists koll_rapporter_anvandare_idx
  on koll_rapporter (anvandare, skapad desc) where anvandare is not null;
