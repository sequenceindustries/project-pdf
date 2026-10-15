-- Peedf workspace: durable jobs, stored files and usage tracking.
--
-- Content (file bytes, the instruction text, AI results) is purged when a
-- job's expires_at passes. Metadata without content is kept for usage
-- reporting and deleted after JOB_METADATA_DAYS.

create table if not exists blobs (
  id          uuid primary key,
  data        bytea not null,
  size        integer not null,
  sha256      text not null,
  created_at  timestamptz not null default now()
);

create table if not exists jobs (
  id               uuid primary key,
  owner_hash       text not null,
  ip_hash          text,
  instruction      text,
  status           text not null check (status in
                     ('queued','processing','validating','completed','failed','cancelled','needs_input')),
  plan             jsonb,
  planner          text,
  progress         jsonb not null default '{}'::jsonb,
  result           jsonb,
  error_code       text,
  error_message    text,
  attempts         integer not null default 0,
  max_attempts     integer not null default 3,
  lease_until      timestamptz,
  worker_id        text,
  cancel_requested boolean not null default false,
  uses_ai          boolean not null default false,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  expires_at       timestamptz not null,
  purged_at        timestamptz
);

create index if not exists jobs_queue_idx   on jobs (status, created_at) where status in ('queued','processing','validating');
create index if not exists jobs_owner_idx   on jobs (owner_hash, created_at desc);
create index if not exists jobs_ip_idx      on jobs (ip_hash, created_at desc);
create index if not exists jobs_expiry_idx  on jobs (expires_at) where purged_at is null;

create table if not exists job_files (
  id          uuid primary key,
  job_id      uuid not null references jobs(id) on delete cascade,
  kind        text not null check (kind in ('input','output')),
  position    integer not null,
  name        text not null,
  mime        text not null,
  size        integer not null,
  pages       integer,
  blob_id     uuid references blobs(id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists job_files_job_idx on job_files (job_id, kind, position);

create table if not exists usage_events (
  id             bigserial primary key,
  job_id         uuid,
  owner_hash     text not null,
  kind           text not null,
  tool           text,
  quantity       numeric not null default 0,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  created_at     timestamptz not null default now()
);

create index if not exists usage_owner_idx on usage_events (owner_hash, created_at desc);
create index if not exists usage_kind_idx  on usage_events (kind, created_at desc);
