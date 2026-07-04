# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SanGit is a version-control ecosystem for FL Studio music projects, built for a single producer (schema is multi-producer-ready). Two cooperating systems:

1. **`apps/web/`** — Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage, Realtime) web app: project dashboard, per-project version timeline tree, audio player, likes/comments, "Main" track designation, public/private share links. Deployed on Vercel.
2. **`service/`** — Python tray app for Windows: watches FL Studio project folders for `.flp` saves, prompts to commit, snapshots + uploads the `.flp`, and queues an `.mp3` render (via `FL64.exe /R /Emp3`) that runs when FL Studio closes.
3. **`supabase/`** — SQL migrations, RLS policies, storage bucket config.

The full approved implementation plan (schema, API surface, flows, build order) lives at `C:\Users\LOQ\.claude\plans\plan-a-dual-layer-application-glimmering-goose.md`. Consult it before making architectural changes.

## Commands

Web app (run from `apps/web/`):

```
npm run dev      # dev server (Turbopack)
npm run build    # production build — use this to type-check the app
npm run lint     # eslint
```

Python service (run from `service/`, once it exists): `python main.py`. No test framework is configured yet in either half.

## Critical version notes

- **Next.js 16.2.10 has breaking changes vs. older App Router knowledge.** Read `apps/web/node_modules/next/dist/docs/` before writing Next.js code (see `apps/web/AGENTS.md`). Known: route-handler/page `params` is a `Promise` (must `await`), and `middleware.ts` is deprecated — the file convention is `proxy.ts` exporting `proxy()`.
- **Tailwind CSS v4** — no `tailwind.config.js`; theme tokens are defined in CSS via `@theme` in `apps/web/src/app/globals.css`.

## Architecture decisions that constrain code

- **Branching model**: folder = project, `.flp` filename = branch, each save = a version on that branch. Project identity comes from a `.sangit.json` marker file the service writes into the FL project folder (contains the project UUID); the server upserts project/branch from it on ingest.
- **Uploads never proxy through Next.js/Vercel** (4.5 MB body limit): the ingest API (`/api/ingest/*`) hands out presigned Supabase Storage upload URLs and the service PUTs files directly. Ingest routes authenticate with a device token (`Authorization: Bearer`, hashed in the `devices` table), not a user session.
- **All audio playback uses short-lived signed URLs** minted server-side from private buckets (`flp-files`, `audio`) — never public storage URLs. This is what makes private share links (`share_links` table: expiring, revocable, view-logged) enforceable. Private-link access bypasses RLS via `GET /api/listen/[token]`.
- **Render status lifecycle**: versions are created with `render_status='pending'` (`.flp` only); the local service later uploads the mp3 and flips it to `ready`/`failed`. UI must handle all states.
- **RLS everywhere**: every table is scoped by `user_id`; owner has full CRUD, public read only on `is_public` projects. Web CRUD goes through supabase-js + RLS directly; route handlers exist only where server logic is required (ingest, pairing, share-link minting, Set-as-Main).

## Design system

`apps/web/DESIGN.md` is the authoritative visual spec (Linear-style dark theme). Non-negotiables: canvas `#010102` (never pure black), four-step surface ladder + 1px hairline borders instead of shadows, a single lavender accent `#5e6ad2` used scarcely (primary CTA, focus, Main-version indicator, playhead), success green `#27a644` as the only other chromatic color, 8px radius buttons (never pill CTAs), 12px cards, 16px protagonist panels, Inter + JetBrains Mono. No light mode, no gradients, no second accent.
