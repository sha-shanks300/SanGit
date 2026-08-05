# Running a development copy

These are the steps to stand up your own instance for local development.

> Running an instance requires permission from the copyright holder — see
> [LICENSE](../LICENSE). Open an issue if you'd like to.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in `supabase/migrations/` in filename
   order, starting with `20260704000001_init.sql` (or `supabase db push` with
   the Supabase CLI).
3. **Auth → Providers**: enable Email and, optionally, Google.
4. **Auth → URL Configuration**: add your site URL and
   `https://<your-site>/auth/callback` as a redirect URL.

## 2. Web app

```bash
cd apps/web
cp .env.example .env.local   # Supabase URL + anon key + service-role key
npm install
npm run dev
```

To deploy: import the repo on Vercel with root directory `apps/web`, set the
same environment variables, and point `NEXT_PUBLIC_SITE_URL` at the deployed
origin.

Useful scripts, all from `apps/web/`:

```bash
npm run build    # production build — also the way to type-check
npm run lint     # eslint
```

## 3. Tray service

```bash
cd service
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python main.py
```

First run opens a setup window asking for:

- **Web app URL** — your deployed site, or `http://localhost:3000`
- **Pairing code** — generate one in the web app under *Settings → Devices*
- **Projects folder** — the folder holding your FL Studio projects
- **FL Studio executable** — usually
  `C:\Program Files\Image-Line\FL Studio 21\FL64.exe`

After that it lives in the tray. Save in FL Studio, close FL Studio, and a
prompt asks whether to commit the session. The `.flp` uploads immediately; the
mp3 render runs once FL has quit, or on demand via *Render queue now* in the
tray menu.

Force the settings dialog open again at any time:

```bash
.venv\Scripts\python main.py --setup
```

### Packaging

```bash
.venv\Scripts\pip install pyinstaller
.venv\Scripts\python build_exe.py         # -> dist/SanGit.exe
.venv\Scripts\python build_installer.py   # -> dist/SanGitSetup.exe (needs Inno Setup 6)
```

`build_installer.py` runs the exe build first, then compiles
`installer/SanGit.iss`, stamping the version from `service/version.py`.

When cutting a release, keep `service/version.py` and
`apps/web/src/lib/app-version.ts` in sync — the tray app's updater compares its
own version against the latest GitHub release, and the web download popup shows
the same number.

## Testing ingest without FL Studio

`scripts/test_ingest.py` drives the whole device path — pair, presign, upload,
complete — so the API can be exercised without a DAW:

```bash
python scripts/test_ingest.py --api http://localhost:3000 --pair <CODE>
python scripts/test_ingest.py --api http://localhost:3000 --token sgd_... test.flp
```

## Dev-only preview pages

These render real components with mock data, and 404 in production builds:

| Route | Shows |
|---|---|
| `/dev/graph` | version tree + force-directed graph |
| `/dev/now-playing` | player bar, full-screen overlay, mobile sheet |
| `/dev/share` | share-link tool, both scopes |
