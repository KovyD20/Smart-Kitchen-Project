# Deployment guide

Step-by-step, from nothing to a live URL. Everything here is free tier.

| Part | Host | Why |
|---|---|---|
| Frontend (React build) | **Vercel** | Static files on a CDN — never sleeps, no cold start |
| Backend (Express) | **Render** | Declarative [`render.yaml`](render.yaml) blueprint; auto-deploys on push |
| PostgreSQL (pantry catalog) | **Neon** | Managed, needs only a connection string |
| Auth + per-user data | **Firebase** | Already used by the app |

> **The free-tier tradeoff, stated plainly:** Render's free web service spins down after
> **15 minutes** of inactivity and takes **30–60 s** to come back. That is long enough
> for a first-time visitor to assume the app is broken, so read
> [Cold start](#cold-start-what-your-users-will-actually-see) before sharing the link —
> the keep-warm ping there removes the problem for free.
>
> The upside of Render is that the whole service is described by a committed blueprint:
> you point Render at the repo, it reads `render.yaml`, and prompts you once for the
> secrets. There is no per-setting clicking to get wrong.

---

## Before you start

Have these ready:

- The repo pushed to GitHub
- A **Gemini API key** — https://aistudio.google.com/app/apikey
- Your **Firebase project** with Authentication + Firestore already set up
  (see the README's [Getting Started](README.md#getting-started))

---

## Step 1 — Database (Neon)

1. Sign up at **https://neon.tech** with GitHub. No credit card.
2. **Create project** — name it `smart-kitchen`, region **Europe (Frankfurt)**.
3. On the project dashboard open **Connection Details** and copy the values. A Neon
   connection string looks like:

   ```
   postgresql://USER:PASSWORD@ep-cool-name-123456.eu-central-1.aws.neon.tech/DBNAME?sslmode=require
   ```

   Split it into the parts this app expects:

   | Variable | From the string |
   |---|---|
   | `DB_USER` | between `//` and `:` |
   | `DB_PASSWORD` | between `:` and `@` |
   | `DB_HOST` | between `@` and `/` |
   | `DB_NAME` | after the last `/`, before `?` |
   | `DB_PORT` | `5432` |
   | `DB_SSL` | `true` |

## Step 2 — Create and seed the catalog schema

Run this **from your machine**, not from the host. Put the Neon values in
`backend/.env`, then:

```bash
cd backend
npm run db:setup
```

That applies `db/schema.sql` and seeds the catalog (13 categories, 220 items). You only
need it once — and again whenever `scripts/pantrySeedData.js` changes.

> `npm run migrate` alone is idempotent and safe to re-run any time.
> `npm run seed` **truncates** the catalog tables first, so don't run it casually.

## Step 3 — Firebase service account

The backend verifies ID tokens, which needs admin credentials:

1. Firebase Console → ⚙️ **Project Settings** → **Service accounts**
2. **Generate new private key** → downloads a JSON file
3. From that JSON you need three values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

   Paste the private key **as one line, keeping the literal `\n` sequences**, wrapped in
   double quotes. The backend converts them back to real newlines.

> Treat this file like a password. Never commit it.

---

## Step 4 — Backend (Render)

### 4.1 Register

1. Sign up at **https://render.com** with GitHub. No credit card for the free plan.
2. Authorise Render for your `Smart-Kitchen-Project` repository.

### 4.2 Create the service from the blueprint

**Dashboard → New → Blueprint** → pick the repo → branch **`master`**.

Render reads [`render.yaml`](render.yaml) and fills in everything that isn't a secret:

| Setting | Comes from the blueprint |
|---|---|
| Runtime | `node` |
| **Root directory** | **`backend`** — this is a monorepo; the repo root has no `package.json` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Plan / region | `free` / `frankfurt` |
| Health check | `/health` |
| `NODE_ENV`, `TRUST_PROXY`, `INSTANCE_NAME`, `DB_SSL`, `GEMINI_MODEL`, `DB_PORT` | fixed values |

Render then **prompts you once for the nine `sync: false` variables** — that is the only
data entry in this step, and nothing sensitive is committed. Copy them straight out of
your `backend/.env`:

`CORS_ORIGIN` (leave blank for now — filled in at Step 6), `DB_HOST`, `DB_NAME`,
`DB_USER`, `DB_PASSWORD`, `GEMINI_API_KEY`, `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

Paste `FIREBASE_PRIVATE_KEY` as **one line, keeping the literal `\n` sequences** — the
backend converts them back to real newlines.

> Do **not** set `PORT`. Render injects it, and [`server.js`](backend/server.js) already
> reads `Number(process.env.PORT || 3000)`.

If `plan: free` or `region: frankfurt` is ever rejected for your account, change those
two lines in `render.yaml` (`oregon` is Render's default region) and re-sync the
blueprint.

### 4.3 Deploy and check

Render builds and deploys on its own. Your URL will look like:

```
https://smart-kitchen-api.onrender.com
```

Verify in this order. The **first** call can take 30–60 s if the service has spun down —
that is the free tier waking up, not a failure:

```bash
curl https://smart-kitchen-api.onrender.com/health
# {"status":"ok","instance":"render"}

curl https://smart-kitchen-api.onrender.com/api/db/health
# {"status":"ok","instance":"render","db_time":"..."}    <- proves Neon + SSL work

curl https://smart-kitchen-api.onrender.com/api/pantry/catalog
# {"categories":[...]}                                   <- proves the seed worked
```

If `/health` works but `/api/db/health` errors, the problem is the `DB_*` variables or
`DB_SSL`, nothing else.

Push to `master` from now on and Render rebuilds automatically. Build and runtime logs
are under **Logs** in the service dashboard.

## Step 5 — Frontend (Vercel)

### 5.1 Register and import

1. Sign up at **https://vercel.com** with GitHub.
2. **Add New → Project** → import the `Smart-Kitchen-Project` repo.
3. ⭐ Set **Root Directory** to **`frontend`**.

Framework preset, build command and output directory are already handled by
[`frontend/vercel.json`](frontend/vercel.json), which also adds the SPA rewrite so deep
links don't 404.

### 5.2 Environment variables

Add all of these under **Settings → Environment Variables** (Production):

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | from Firebase → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | ” |
| `VITE_FIREBASE_PROJECT_ID` | ” |
| `VITE_FIREBASE_STORAGE_BUCKET` | ” |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ” |
| `VITE_FIREBASE_APP_ID` | ” |
| `VITE_FIREBASE_MEASUREMENT_ID` | ” (optional) |
| ⭐ `VITE_API_BASE_URL` | your Render URL, **no trailing slash** |

> `VITE_*` variables are baked into the bundle **at build time**. Changing one requires
> a **redeploy** — editing it in the dashboard alone does nothing to the live site.
>
> These Firebase values are public by design; they identify the project, they don't
> grant access. Access is controlled by Auth + Firestore rules. The Gemini key is the
> one that must never be here.

Click **Deploy**. You get a URL like `https://smart-kitchen.vercel.app`.

---
## Step 6 — Close the loop

Two settings still point nowhere. Both will silently break login or every API call.

1. **Render → your service → Environment → `CORS_ORIGIN`** = your Vercel URL, e.g.
   `https://smart-kitchen.vercel.app` (no trailing slash). Saving it redeploys the
   service. Without this the browser blocks every API response as a CORS error.
2. **Firebase Console → Authentication → Settings → Authorized domains** → **Add
   domain** → `smart-kitchen.vercel.app`. Without this sign-in fails with
   `auth/unauthorized-domain`.

---

## Step 7 — Verify the live app

Open the Vercel URL and check:

- [ ] Sign-in works (email/password and Google)
- [ ] The fridge/shopping views group items into categories → the catalog API works
- [ ] Adding a recipe persists after reload → Firestore works
- [ ] AI generation returns a recipe → Gemini + auth + CORS all work
- [ ] Hard-refresh on a deep link doesn't 404 → the SPA rewrite works

---

## Cold start: what your users will actually see

This is the free tier's one real drawback, so plan for it rather than discover it.

Render's free web service **spins down after 15 minutes** of inactivity and takes
**30–60 s** to come back. That delay hits only the **first** request after a spin-down,
and only the two backend-backed things:

- the pantry catalog fetch on load (categories appear late)
- the first AI generation

Firestore and Auth are unaffected — the browser talks to them directly, so sign-in and
your recipes/fridge/list are instant regardless. But 30–60 s is long enough that a
first-time visitor will assume the app is broken.

**Fix it with a keep-warm ping.** Point a free scheduler such as **cron-job.org** at the
health endpoint every 10 minutes:

```
https://smart-kitchen-api.onrender.com/health
```

`/health` is deliberately DB-free, so the pings cost nothing on Neon and barely register
on Render. With a 10-minute interval the service never idles long enough to spin down,
and visitors never see a cold start.

> Render's free tier also has a monthly instance-hours allowance. A ping every 10 minutes
> keeps one service awake continuously, which consumes those hours — fine for a single
> demo service, worth knowing if you add more.

**If you want zero sleep at all:** move the three Express route handlers into Vercel
Serverless Functions next to the frontend. Same origin (no CORS, no `VITE_API_BASE_URL`),
nothing to spin down. That's a real refactor, and serverless has its own — much smaller —
cold start, so it's a trade rather than a free win.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Build fails, "no package.json" | `rootDir: backend` missing — re-sync the blueprint |
| Blueprint rejected `plan`/`region` | Change those two lines in `render.yaml` (`oregon` is the default region) |
| Service builds then is marked unhealthy | `healthCheckPath` isn't `/health`, or `PORT` was set manually — don't set it |
| First request takes 30–60 s | Normal free-tier spin-up; see [Cold start](#cold-start-what-your-users-will-actually-see) |
| Every API call is a CORS error | `CORS_ORIGIN` doesn't exactly match the Vercel origin. Most common: `http://` where the site is served over `https://`. Also check for a trailing slash. The backend logs its allowed origins at boot |
| App renders empty (no categories, no fridge items), yet every endpoint works in the browser | Same CORS mismatch as above. Hitting the API in the address bar sends no `Origin` header, so it looks healthy; only the browser's cross-origin check fails |
| `auth/unauthorized-domain` on sign-in | Vercel domain not in Firebase authorized domains |
| API calls hit the Vercel domain, not Render | `VITE_API_BASE_URL` missing at build time — set it and **redeploy** |
| `/api/ai/*` returns 503 | `FIREBASE_*` vars missing on Render — the backend fails closed on purpose |
| `/api/ai/*` returns 401 | ID token missing/expired; sign out and back in |
| `/api/db/health` errors, `/health` fine | `DB_*` values or `DB_SSL=true` |
| `/api/pantry/catalog` returns empty | Step 2 seed never ran against Neon |
| Deep link 404s on refresh | `frontend/vercel.json` not picked up — Root Directory isn't `frontend` |

---

## Sources

Render free-tier behaviour and blueprint fields verified July 2026:

- [Blueprint spec](https://render.com/docs/blueprint-spec) — `plan: free`, `region: frankfurt`, `rootDir`, `healthCheckPath`, `envVars` with `sync: false`
- [Free instance types](https://render.com/docs/free) — 15-minute spin-down, 30–60 s cold start
- [Deploy hooks & keep-warm](https://render.com/docs/deploys) — redeploy on push behaviour
