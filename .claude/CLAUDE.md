# Smart Kitchen

Full-stack AI-alapú konyhai asszisztens: hűtő-nyilvántartás, receptkezelés, bevásárlólista, és AI-alapú receptgenerálás abból, ami épp otthon van.

## Tech Stack

- **Frontend**: React 19, Vite 7, Three.js (animált háttér), Firebase JS SDK
- **Backend**: Node.js 22, Express 5, `pg`, `zod`, `helmet`, `express-rate-limit`, `firebase-admin`
- **Adatbázisok**: PostgreSQL 16 (globális pantry katalógus), Cloud Firestore (per-user adatok: hűtő, receptek, bevásárlólista)
- **Auth**: Firebase Authentication (email/jelszó + Google)
- **AI**: Google Gemini a `@google/genai` csomagon keresztül. A modell-ID **csak** az `AI_MODEL`
  env-változóban él (default: `gemini-3.6-flash`), a hívás egyetlen helyen, a
  `backend/lib/aiClient.js`-ben. A Gemini flash-generációkat kb. félévente kivezetik, és a
  leállítás azonnali (404) — **évente kétszer ellenőrizd a modell-listát**; a váltás ilyenkor
  egy env-változó, nem kódmódosítás. Gyors diagnózis: `npm run ai:smoke` a `backend`-ben.
- **Tesztek**: Vitest mindkét workspace-ben, GitHub Actions CI

## Architektúra — miért két adatbázis

A böngésző **közvetlenül** beszél a Firestore-ral (real-time `onSnapshot`, per-user security rules) — ez adja a hűtő/receptek/bevásárlólista élő szinkronját. Az Express backend csak azért létezik, mert a böngésző nem tarthatja a Gemini API kulcsot, és nem érheti el közvetlenül a PostgreSQL-t. A pantry katalógus (kategóriák → tételek → aliasok) relációs jellege miatt van Postgresben.

Ha valamit hozzáadnál: **per-user, real-time adat → Firestore**; **globális, relációs katalógus-adat → Postgres**. Ne keverd a kettőt csak azért, mert "egyszerűbb lenne".

## Directory Structure

```
backend/
├── server.js
├── db/            # pool.js, schema.sql
├── lib/           # normalize.js, aiClient.js, aiError.js, aiSchemas.js, firebaseAdmin.js
├── middleware/     # auth.js, rateLimit.js, validate.js
├── routes/         # ai.js, db.js, pantry.js
└── scripts/         # migrate.js, seedPantry.js, aiSmokeTest.js

frontend/src/
├── components/     # AiRecipePanel, AuthPanel, Background, Icon, NewRecipeForm, views
├── context/        # CatalogContext, ConfirmContext, ToastContext
├── hooks/          # useInventory, useRecipes, useCollapsedGroups, useIsMobile
├── lib/            # api.js, inventory.js, recipes.js, units.js
├── pages/          # Home.jsx
└── constants/      # pantryCatalog.js, units.js
```

## Commands

```bash
# Backend (port 3000)
cd backend && npm run dev
npm test              # vitest run
npm run db:setup       # migrate + seed (seed truncate-eli a katalógust!)

# Frontend (port 5173)
cd frontend && npm run dev
npm run lint
npm test
```

## Coding Conventions

- Backend: CommonJS, request body validáció **mindig** `zod`-dal
- Frontend: funkcionális komponensek, hookok (`use*.js`) a state logikára, komponensek csak megjelenítésre
- A Gemini API kulcs **soha** nem kerülhet a frontend bundle-be — csak a backend `.env`-jében élhet
- Mértékegység-normalizálás (`backend/lib/normalize.js`) az egyetlen hely, ahol az ékezet-eltávolítás/kisbetűsítés történik — ne duplikáld máshol, seed és runtime ugyanazt a modult használja
- CRUD a recept/hűtő/bevásárlólista adatokon a Firestore-on át megy közvetlenül a kliensről, **nem** az Express API-n keresztül

## Important Notes

- `.env` és `.env.local` fájlokat soha ne commitolj
- `archive/` a régi Docker Compose + Nginx demó, **nem** az aktuális futtatási mód — ne vedd figyelembe új funkcióknál
- Render (backend) 15 perc inaktivitás után leáll, 30-60s-et alszik felébredéskor — ez csak a katalógus-fetchet és az első AI hívást érinti
- Teljes deploy-lépések: `.local_directory/DEPLOY.md` (helyi, nincs a repóban)
