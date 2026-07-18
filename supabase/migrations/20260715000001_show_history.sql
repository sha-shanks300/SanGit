-- Public profile curation: a shown project reveals only its Main (or latest
-- ready) track by default; the full version tree is an explicit opt-in.
alter table projects
  add column show_history boolean not null default false;
