-- Likeness on Neon (Postgres). The NEAR contract is the authority for licences, escrow, receipts and status; this
-- database holds what doesn't belong on-chain: image bytes, prompts, the advisory check's detail, briefs, the agent's
-- activity log, sessions, rate limits and AI spend. Idempotent: safe to run again (scripts/db-migrate.ts).

-- Every image, content-addressed. Captures are never public; an ad becomes public only once the contract's
-- verify(sha256) says Licensed (then it's served with immutable caching).
create table if not exists media (
  sha256      text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  mime        text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes       bytea not null,
  size        integer not null check (size > 0 and size <= 4000000),
  kind        text not null check (kind in ('capture', 'ad')),
  creator     text not null,
  brand       text,
  public      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists media_creator on media (creator);

-- A creator's consented live capture: three frames (front is the reference for edits and the face check).
create table if not exists captures (
  creator       text primary key,
  front_sha256  text not null references media (sha256),
  left_sha256   text not null references media (sha256),
  right_sha256  text not null references media (sha256),
  liveness      jsonb not null,
  consent_at    timestamptz not null default now()
);

-- What the agent asked for.
create table if not exists campaigns (
  id             bigserial primary key,
  brand          text not null,
  brief          text not null,
  usage          text not null,
  duration_days  integer not null,
  render_cap     integer not null,
  scene          text not null,
  product        text not null,
  created_at     timestamptz not null default now()
);
create index if not exists campaigns_brand on campaigns (brand, created_at desc);
alter table campaigns add column if not exists creator text;
alter table campaigns add column if not exists licence_id text;
create index if not exists campaigns_licence on campaigns (licence_id);

-- Each ad the agent made: its exact prompt, the advisory check's answer, the model's provenance, the transactions.
create table if not exists renders (
  sha256       text primary key references media (sha256),
  licence_id   text not null,
  brand        text not null,
  creator      text not null,
  campaign_id  bigint references campaigns (id),
  prompt       text not null,
  face_check   jsonb not null,
  provenance   jsonb not null,
  submit_tx    text,
  decision_tx  text,
  created_at   timestamptz not null default now()
);
create index if not exists renders_creator on renders (creator, created_at desc);
create index if not exists renders_brand on renders (brand, created_at desc);

-- The agent's activity log, per brand (every pick and skip with its reason).
create table if not exists activity (
  id          bigserial primary key,
  brand       text not null,
  at          timestamptz not null default now(),
  kind        text not null,
  summary     text not null,
  licence_id  text,
  sha256      text,
  tx          text
);
create index if not exists activity_brand on activity (brand, at desc);

-- Sign-in (NEP-413): one-time challenges and sessions (random ids; the cookie is HMAC-signed).
create table if not exists auth_challenges (
  nonce       text primary key,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);
create table if not exists sessions (
  id          text primary key,
  account_id  text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- Fixed one-minute windows per key (client IP + route class).
create table if not exists rate_limits (
  key           text not null,
  window_start  bigint not null,
  n             integer not null,
  primary key (key, window_start)
);

-- AI spend per UTC day, site-wide ('site') and per brand, in micro-USD: the cost cap is checked before every call.
create table if not exists ai_spend (
  day         date not null,
  scope       text not null,
  calls       integer not null default 0,
  usd_micros  bigint not null default 0,
  primary key (day, scope)
);
