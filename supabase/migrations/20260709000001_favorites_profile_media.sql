-- Favourites (per-project bookmarks), profile banner, and a public image
-- bucket for avatars / banners / project artwork.

-- ---------------------------------------------------------------------------
-- reactions: dislike retired (UI is like-only now). Remove legacy rows so the
-- unique (version_id, user_id) slot frees up; keep the enum value — dropping
-- an enum value requires a type rebuild and buys nothing.
-- ---------------------------------------------------------------------------
delete from reactions where kind = 'dislike';

-- ---------------------------------------------------------------------------
-- favorites: a user bookmarks a project (star). Distinct from reactions,
-- which are per-version.
-- ---------------------------------------------------------------------------
create table favorites (
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index favorites_project_idx on favorites (project_id);

alter table favorites enable row level security;

-- Counts are visible wherever the project is visible; users always see their
-- own bookmarks.
create policy "favorites readable with project or own"
  on favorites for select using (
    user_id = auth.uid() or exists (
      select 1 from projects p
      where p.id = project_id and (p.is_public or p.user_id = auth.uid())
    )
  );
create policy "users favorite visible projects"
  on favorites for insert with check (
    auth.uid() = user_id and exists (
      select 1 from projects p
      where p.id = project_id and (p.is_public or p.user_id = auth.uid())
    )
  );
create policy "users unfavorite"
  on favorites for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- profiles: banner backdrop for the profile header.
-- ---------------------------------------------------------------------------
alter table profiles add column banner_url text;

-- ---------------------------------------------------------------------------
-- public-images bucket: avatars, banners, project artwork. Public read (the
-- URLs are embedded in public pages); writes scoped to the user's own
-- {user_id}/ folder. Files are content-addressed by timestamped names, never
-- overwritten (public bucket = CDN-cached).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-images', 'public-images', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "public images are readable"
  on storage.objects for select
  using (bucket_id = 'public-images');
create policy "users upload own images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own images"
  on storage.objects for update to authenticated
  using (bucket_id = 'public-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-images' and (storage.foldername(name))[1] = auth.uid()::text);
