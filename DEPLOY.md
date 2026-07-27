# Deployment guide

Step-by-step, from nothing to a live URL. Everything here is free tier.

| Part | Host | Why |
|---|---|---|
| Frontend (React build) | **Vercel** | Static files on a CDN — never sleeps, no cold start |
| Backend (Express) | **Koyeb** | Free tier sleeps only after **1 hour** idle and wakes in **1–5 s** |
| PostgreSQL (pantry catalog) | **Neon** | Managed, needs only a connection string |
| Auth + per-user data | **Firebase** | Already used by the app |

> **Why Koyeb and not Render:** Render's free tier sleeps after 15 minutes and takes
> **30–50 s** to wake — long enough that a visitor assumes the app is broken. Koyeb's
> free tier idles at 1 hour and wakes from deep sleep in 1–5 s.
>
> One correction worth knowing: Koyeb's **200 ms "light sleep"** wake (memory
> snapshots) is **not** on the free plan — it's Starter/Pro/Scale/Enterprise only. The
> free instance uses **deep sleep, 1–5 s**. Still a 10× improvement, just not 200 ms.
>
> Free-instance limits: **one per organization**, 512 MB RAM, 0.1 vCPU, 2 GB SSD,
> **Frankfurt or Washington DC** only (pick Frankfurt from Hungary), web services only,
> no volumes, and scale-to-zero **cannot be disabled**. On 0.1 vCPU expect the upper end
> of that 1–5 s range.

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

## Step 4 — Backend (Koyeb)

### 4.1 Register

1. Go to **https://app.koyeb.com** and sign up **with GitHub** (simplest — it also sets
   up repo access). No credit card normally; Koyeb may ask for one only if it can't
   verify you're human.
2. Authorise the Koyeb GitHub app for your `Smart-Kitchen-Project` repository.

### 4.2 Create the service

**Create Web Service** → **GitHub** → pick the repo → branch **`master`**.

Then set these — the two starred ones are the easy ones to get wrong:

| Setting | Value |
|---|---|
| Builder | **Buildpack** (no Dockerfile needed) |
| ⭐ **Work directory** | **`backend`** |
| Build command | leave empty (buildpack runs `npm install`) |
| Run command | leave empty (buildpack runs `npm start`) |
| Region | **Frankfurt (fra)** |
| Instance type | **Free** |
| ⭐ **Exposed port** | leave the default **`8000`** |
| Health check | HTTP, path **`/health`** |
| Service name | `smart-kitchen-api` |

**Why work directory matters:** this is a monorepo. Without it Koyeb builds the repo
root, finds no `package.json`, and the build fails. Setting it to `backend` also means
the rest of the repo is *not* in the build environment — that's fine, `backend/` is
self-contained (its own `package.json` and `package-lock.json`).

**Why leave the port at 8000:** Koyeb injects `PORT` automatically, and
[`server.js`](backend/server.js) already reads `Number(process.env.PORT || 3000)`. You
do **not** need to change any code or set `PORT` yourself.

### 4.3 Environment variables

Add these under **Environment variables**. Mark the secrets as **Secret** type, not
plain text.

| Variable | Value | Secret? |
|---|---|---|
| `TRUST_PROXY` | `true` | no |
| `INSTANCE_NAME` | `koyeb` | no |
| `DB_SSL` | `true` | no |
| `GEMINI_MODEL` | `gemini-2.0-flash` | no |
| `CORS_ORIGIN` | *fill in at Step 6* | no |
| `DB_HOST` | from Step 1 | no |
| `DB_PORT` | `5432` | no |
| `DB_NAME` | from Step 1 | no |
| `DB_USER` | from Step 1 | no |
| `DB_PASSWORD` | from Step 1 | **yes** |
| `GEMINI_API_KEY` | your Gemini key | **yes** |
| `FIREBASE_PROJECT_ID` | from Step 3 | no |
| `FIREBASE_CLIENT_EMAIL` | from Step 3 | no |
| `FIREBASE_PRIVATE_KEY` | from Step 3, one line with `\n` | **yes** |

`TRUST_PROXY=true` is required here: Koyeb terminates TLS at its own edge, so the real
client IP only arrives in `X-Forwarded-For`. Without it every unauthenticated caller
would share a single rate-limit bucket.

Do **not** set `PORT`. Do **not** set `NODE_ENV` unless you want to — nothing branches
on it.

### 4.4 Deploy and check

Click **Deploy**. First build takes a few minutes. Your URL will be something like:

```
https://smart-kitchen-api-<your-org>.koyeb.app
```

Verify, in order:

```bash
curl https://smart-kitchen-api-<your-org>.koyeb.app/health
# {"status":"ok","instance":"koyeb"}

curl https://smart-kitchen-api-<your-org>.koyeb.app/api/db/health
# {"status":"ok","instance":"koyeb","db_time":"..."}   <- proves Neon + SSL work

curl https://smart-kitchen-api-<your-org>.koyeb.app/api/pantry/catalog
# {"categories":[...]}                                 <- proves the seed worked
```

If `/health` works but `/api/db/health` returns an error, the problem is the `DB_*`
variables or `DB_SSL`, nothing else.

Push to `master` from now on and Koyeb rebuilds automatically.

---

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
| ⭐ `VITE_API_BASE_URL` | your Koyeb URL, **no trailing slash** |

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

1. **Koyeb → your service → Environment variables → `CORS_ORIGIN`** = your Vercel URL,
   e.g. `https://smart-kitchen.vercel.app` (no trailing slash). Redeploy the service.
   Without this the browser blocks every API response as a CORS error.
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

The backend sleeps after **1 hour** with no traffic and takes **1–5 s** to wake. That
delay hits only the **first** request after sleeping, and only the two backend-backed
things:

- the pantry catalog fetch on load (categories appear a beat late)
- the first AI generation

Firestore and Auth are unaffected — the browser talks to them directly, so sign-in and
your recipes/fridge/list are instant regardless.

If even 1–5 s bothers you, ping the health endpoint every 10 minutes from a free
scheduler such as **cron-job.org**:

```
https://smart-kitchen-api-<your-org>.koyeb.app/health
```

`/health` is deliberately DB-free, so keep-warm pings cost nothing on Neon. Note this
keeps the instance awake permanently, which is against the spirit of a free tier — a
15-minute interval is plenty and gentler.

**If you want zero sleep at all:** move the Express routes into Vercel Serverless
Functions next to the frontend. Same origin (no CORS), no sleeping instance. That's a
real refactor — three route handlers rewritten as functions — and serverless has its own
smaller cold start, so it's a trade, not a free win.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Koyeb build fails, "no package.json" | **Work directory** isn't set to `backend` |
| App starts then Koyeb marks it unhealthy | Health check path isn't `/health`, or the exposed port was changed without setting `PORT` |
| Every API call is a CORS error | `CORS_ORIGIN` doesn't exactly match the Vercel origin (scheme, no trailing slash) |
| `auth/unauthorized-domain` on sign-in | Vercel domain not in Firebase authorized domains |
| API calls hit the Vercel domain, not Koyeb | `VITE_API_BASE_URL` missing at build time — set it and **redeploy** |
| `/api/ai/*` returns 503 | `FIREBASE_*` vars missing on Koyeb — the backend fails closed on purpose |
| `/api/ai/*` returns 401 | ID token missing/expired; sign out and back in |
| `/api/db/health` errors, `/health` fine | `DB_*` values or `DB_SSL=true` |
| `/api/pantry/catalog` returns empty | Step 2 seed never ran against Neon |
| Deep link 404s on refresh | `frontend/vercel.json` not picked up — Root Directory isn't `frontend` |

---

## Sources

Koyeb free-tier behaviour verified July 2026:

- [Scale-to-Zero](https://www.koyeb.com/docs/run-and-scale/scale-to-zero) — 1 h idle, deep sleep 1–5 s, light sleep is paid-plan only
- [Instances](https://www.koyeb.com/docs/reference/instances) — free instance specs and limits
- [Monorepos](https://www.koyeb.com/docs/build-and-deploy/monorepo) — work directory
- [Deploy an Express App](https://www.koyeb.com/docs/deploy/express) — buildpack, `npm start`, `PORT`
- [Exposing your Service](https://www.koyeb.com/docs/build-and-deploy/exposing-your-service) — default port 8000, `PORT` injection
