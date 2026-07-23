-- Flip the public-project default so a shared project shows its full version
-- tree to visitors by default (all versions visible, likeable, commentable),
-- with "Main only" as a deliberate per-project opt-out. This matches the
-- product's point: the versions and per-version feedback are the selling
-- point, not a single polished track.
alter table projects alter column show_history set default true;

-- Backfill existing projects to the new default so the current catalog shows
-- all versions immediately. Any project can be switched back to Main only from
-- Project settings afterward.
update projects set show_history = true;
