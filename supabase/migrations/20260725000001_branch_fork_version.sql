-- Explicit fork anchor for a branch: the version it forked from. Lets a
-- "Branch & commit" fork from an older version (e.g. the current tip's parent,
-- making the new branch a sibling of the tip) instead of the graph guessing
-- the fork point by wall-clock time. Nullable — existing branches keep the
-- timestamp-based fallback in lib/graph-data.ts.
alter table branches
  add column fork_version_id uuid references versions (id) on delete set null;
