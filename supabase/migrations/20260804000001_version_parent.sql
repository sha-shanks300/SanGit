-- Explicit single-parent ancestry for a version. The open-tree branching model
-- records, at commit time, the exact node a version descends from (the tip of
-- the branch the file was on) instead of the graph inferring it from wall-clock
-- order + a per-branch fork anchor. Nullable — the very first commit in a
-- project is a root, and pre-migration rows fall back to the timestamp guess in
-- lib/graph-data.ts / timeline-tree.tsx.
alter table versions
  add column parent_version_id uuid references versions (id) on delete set null;

create index versions_parent_version_id_idx on versions (parent_version_id);

-- Keep the tree connected when a mid-chain version is deleted: relink its
-- children onto its own parent (their grandparent) before the row goes, so a
-- deletion never orphans a descendant. The FK's `on delete set null` above is a
-- backstop for any child this misses.
create or replace function reparent_versions_on_delete()
returns trigger
language plpgsql
as $$
begin
  update versions
    set parent_version_id = old.parent_version_id
    where parent_version_id = old.id;
  return old;
end;
$$;

create trigger versions_reparent_before_delete
  before delete on versions
  for each row
  execute function reparent_versions_on_delete();
