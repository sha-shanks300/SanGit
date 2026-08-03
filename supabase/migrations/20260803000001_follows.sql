-- My artists: a private, one-directional follow (bookmark) of another
-- producer. Modeled on `favorites`, but deliberately MORE private: a user can
-- read only their OWN follow rows, so a follower count is never exposed to the
-- followee. This is a personal shelf, not a social signal.

create table follows (
  follower_id uuid not null references profiles (id) on delete cascade,
  followee_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  -- No self-follow. Enforced here too so RLS isn't the only guard.
  constraint follows_no_self check (follower_id <> followee_id)
);

-- "My artists" reads by follower_id (covered by the PK prefix). The reverse
-- lookup (who follows X) has no v1 surface, but the index is cheap and mirrors
-- favorites' project index — keep it for future-proofing.
create index follows_followee_idx on follows (followee_id);

alter table follows enable row level security;

-- Private shelf: you only ever see your own follows. The followee never learns
-- who — or how many — follow them, so there is intentionally NO "readable by
-- the followee" policy.
create policy "users read own follows"
  on follows for select using (follower_id = auth.uid());
create policy "users follow others"
  on follows for insert with check (
    auth.uid() = follower_id and follower_id <> followee_id
  );
create policy "users unfollow"
  on follows for delete using (auth.uid() = follower_id);
