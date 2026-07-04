-- SanGit initial schema. See plan section 1.1.

create type render_status as enum ('pending', 'rendering', 'ready', 'failed');
create type reaction_kind as enum ('like', 'dislike');
create type share_link_kind as enum ('public', 'private');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_-]{3,30}$'),
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row on signup, deriving a username from the email.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_-]', '', 'g'));
  if length(base) < 3 then
    base := 'user' || substr(new.id::text, 1, 6);
  end if;
  base := substr(base, 1, 24);
  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data ->> 'full_name', candidate));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- devices (local-service auth: long-lived token, stored hashed)
-- ---------------------------------------------------------------------------
create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  token_hash text unique not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Short-lived pairing codes shown on the dashboard, exchanged by the service
-- for a device token.
create table device_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  code text unique not null,
  device_name text,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects / branches / versions
-- ---------------------------------------------------------------------------
create table projects (
  id uuid primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  slug text unique not null,
  main_version_id uuid,
  is_public boolean not null default false,
  artwork_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  parent_branch_id uuid references branches (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table versions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  display_name text,
  file_name text not null,
  flp_storage_path text,
  mp3_storage_path text,
  render_status render_status not null default 'pending',
  render_error text,
  flp_sha256 text not null,
  duration_secs real,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table projects
  add constraint projects_main_version_fk
  foreign key (main_version_id) references versions (id) on delete set null;

create index versions_branch_idx on versions (branch_id, uploaded_at);
create index versions_project_idx on versions (project_id, uploaded_at);
create index branches_project_idx on branches (project_id);
create index projects_user_idx on projects (user_id);

-- ---------------------------------------------------------------------------
-- reactions / comments
-- ---------------------------------------------------------------------------
create table reactions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references versions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  kind reaction_kind not null,
  created_at timestamptz not null default now(),
  unique (version_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references versions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index reactions_version_idx on reactions (version_id);
create index comments_version_idx on comments (version_id, created_at);

-- ---------------------------------------------------------------------------
-- share links
-- ---------------------------------------------------------------------------
create table share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  version_id uuid references versions (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,
  token_hash text unique not null,
  kind share_link_kind not null default 'private',
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  max_views int,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  check (version_id is not null or project_id is not null)
);

create table link_views (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references share_links (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create index link_views_link_idx on link_views (share_link_id, viewed_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table devices enable row level security;
alter table device_pairings enable row level security;
alter table projects enable row level security;
alter table branches enable row level security;
alter table versions enable row level security;
alter table reactions enable row level security;
alter table comments enable row level security;
alter table share_links enable row level security;
alter table link_views enable row level security;

-- profiles: public read, owner update.
create policy "profiles are publicly readable"
  on profiles for select using (true);
create policy "users update own profile"
  on profiles for update using (auth.uid() = id);

-- devices / pairings: owner only. Token validation happens with the service
-- role in API routes, which bypasses RLS.
create policy "owner manages devices"
  on devices for all using (auth.uid() = user_id);
create policy "owner manages pairings"
  on device_pairings for all using (auth.uid() = user_id);

-- projects: owner CRUD, public read on public projects.
create policy "owner manages projects"
  on projects for all using (auth.uid() = user_id);
create policy "public projects are readable"
  on projects for select using (is_public);

-- branches / versions: owner CRUD, readable when parent project is public.
create policy "owner manages branches"
  on branches for all using (auth.uid() = user_id);
create policy "branches of public projects are readable"
  on branches for select using (
    exists (select 1 from projects p where p.id = project_id and p.is_public)
  );

create policy "owner manages versions"
  on versions for all using (auth.uid() = user_id);
create policy "versions of public projects are readable"
  on versions for select using (
    exists (select 1 from projects p where p.id = project_id and p.is_public)
  );

-- reactions / comments: readable where the version is readable; authenticated
-- users write their own, only on public projects (owner can always).
create policy "reactions on public projects are readable"
  on reactions for select using (
    exists (
      select 1 from versions v join projects p on p.id = v.project_id
      where v.id = version_id and (p.is_public or p.user_id = auth.uid())
    )
  );
create policy "users react on public versions"
  on reactions for insert with check (
    auth.uid() = user_id and exists (
      select 1 from versions v join projects p on p.id = v.project_id
      where v.id = version_id and (p.is_public or p.user_id = auth.uid())
    )
  );
create policy "users update own reactions"
  on reactions for update using (auth.uid() = user_id);
create policy "users delete own reactions"
  on reactions for delete using (auth.uid() = user_id);

create policy "comments on public projects are readable"
  on comments for select using (
    exists (
      select 1 from versions v join projects p on p.id = v.project_id
      where v.id = version_id and (p.is_public or p.user_id = auth.uid())
    )
  );
create policy "users comment on public versions"
  on comments for insert with check (
    auth.uid() = user_id and exists (
      select 1 from versions v join projects p on p.id = v.project_id
      where v.id = version_id and (p.is_public or p.user_id = auth.uid())
    )
  );
create policy "users delete own comments"
  on comments for delete using (auth.uid() = user_id);
create policy "project owner deletes comments"
  on comments for delete using (
    exists (
      select 1 from versions v join projects p on p.id = v.project_id
      where v.id = version_id and p.user_id = auth.uid()
    )
  );

-- share links: owner only (token holders go through the /api/listen route,
-- which uses the service role).
create policy "owner manages share links"
  on share_links for all using (auth.uid() = user_id);
create policy "owner reads link views"
  on link_views for select using (
    exists (select 1 from share_links s where s.id = share_link_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- updated_at maintenance + realtime
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch before update on projects
  for each row execute function touch_updated_at();

-- Bump the parent project's updated_at when a version lands or changes.
create or replace function touch_project_on_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update projects set updated_at = now() where id = new.project_id;
  return new;
end;
$$;

create trigger versions_touch_project after insert or update on versions
  for each row execute function touch_project_on_version();

alter publication supabase_realtime add table versions, projects;

-- ---------------------------------------------------------------------------
-- storage buckets (private; access via signed URLs minted server-side)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('flp-files', 'flp-files', false), ('audio', 'audio', false)
on conflict (id) do nothing;

create policy "owner reads own flp files"
  on storage.objects for select
  using (bucket_id = 'flp-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner reads own audio"
  on storage.objects for select
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
