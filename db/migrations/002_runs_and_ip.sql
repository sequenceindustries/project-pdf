-- Count every run (new job or re-run on the same files) for limits, and
-- keep the hashed IP on usage rows so AI limits also apply per network.
alter table usage_events add column if not exists ip_hash text;
create index if not exists usage_owner_kind_idx on usage_events (owner_hash, kind, created_at desc);
create index if not exists usage_ip_kind_idx on usage_events (ip_hash, kind, created_at desc) where ip_hash is not null;
