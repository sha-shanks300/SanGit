-- Per-project .flp download passkey: a long random key (shown once at
-- creation, only its SHA-256 stored) that lets non-owners download the .flp
-- from public/shared project pages. Owner downloads stay session-based.

-- ---------------------------------------------------------------------------
-- project_flp_keys: one key per project. Deliberately NOT a column on
-- projects — public projects expose their whole row to anonymous SELECTs,
-- and even a hash has no business being readable. Visitors never read this
-- table; verification happens server-side via the service role.
-- ---------------------------------------------------------------------------
create table project_flp_keys (
  project_id uuid primary key references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  key_hash text not null,
  created_at timestamptz not null default now()
);

alter table project_flp_keys enable row level security;

create policy "owners manage flp keys"
  on project_flp_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
