# SanGit — version control for your music

Git-like version control for FL Studio projects: a Windows tray service that
commits every save you approve, and a web app with a visual version tree,
audio player, and share links.

- **`apps/web/`** — Next.js 16 + Supabase web app (dashboard, timeline tree, player, sharing)
- **`service/`** — Python tray service (save detection, commit popup, mp3 render queue, upload)
- **`supabase/`** — database migrations (schema, RLS, storage buckets)
- **`scripts/`** — `test_ingest.py` simulates a device commit end-to-end

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/20260704000001_init.sql`
   (or `supabase db push` with the Supabase CLI).
3. Auth → Providers: enable **Email** and (optionally) **Google**.
4. Auth → URL Configuration: add your site URL and
   `https://<your-site>/auth/callback` as a redirect URL.

## 2. Run the web app

```bash
cd apps/web
cp .env.example .env.local   # fill in the Supabase URL + anon + service-role keys
npm install
npm run dev
```

Deploy to Vercel by importing the repo with root directory `apps/web` and the
same environment variables. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin.

## 3. Pair the local service

```bash
cd service
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python main.py
```

On first run a setup window asks for:

- **Web app URL** — your deployed site (or `http://localhost:3000`)
- **Pairing code** — generate one in the web app under **Settings → Devices**
- **Projects folder** — the folder containing your FL Studio projects
- **FL Studio executable** — usually `C:\Program Files\Image-Line\FL Studio 21\FL64.exe`

Then it lives in the tray. Save a project in FL Studio → a popup asks to
commit → the `.flp` uploads immediately and the mp3 render is queued. The
render runs automatically **after you close FL Studio** (FL's command-line
renderer can't run alongside your open session) — or force it from the tray
menu with *Render queue now*.

### Package as an .exe (optional)

```bash
.venv\Scripts\pip install pyinstaller
.venv\Scripts\python build_exe.py     # -> dist/SanGit.exe
python install_startup.py             # start at login (HKCU Run key)
```

## How the pieces talk

```
FL Studio save -> watcher (debounced) -> commit popup -> snapshot .flp
  -> POST /api/ingest/init-upload (device token)   [upserts project/branch, dedupes]
  -> PUT .flp directly to Supabase Storage (presigned)
  -> POST /api/ingest/complete                     [version row, render_status=pending]
       ... web timeline shows the node as "processing" instantly (Realtime)
  -> FL Studio closes -> FL64.exe /R /Emp3 renders the snapshot
  -> PUT .mp3 (presigned) -> POST /api/ingest/audio/:id
       ... node flips to playable
```

Project identity lives in a `.sangit.json` marker the service writes into each
project folder. Folder = project, each `.flp` filename = a branch, each save =
a version on that branch.

Playback always uses short-lived signed URLs from private buckets — that's
what makes private share links (`/s/<token>`) expirable and revocable.

## Verifying the ingest path without FL Studio

```bash
python scripts/test_ingest.py --api http://localhost:3000 --pair <CODE>   # prints a device token
python scripts/test_ingest.py --api http://localhost:3000 --token sgd_... test.flp
```
