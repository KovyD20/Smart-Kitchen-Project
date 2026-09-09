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
├── lib/           # normalize.js, buildPantryCatalog.js, aiClient.js, aiError.js,
│                   aiSchemas.js, firebaseAdmin.js, seedOptions.js
├── middleware/     # auth.js, rateLimit.js, validate.js
├── routes/         # ai.js, db.js, pantry.js
└── scripts/         # migrate.js, seedPantry.js, pantrySeedData.js, aiSmokeTest.js

shared/             # amit mindkét workspace tesztje bejár (normalizeCatalogText.cases.json)

frontend/src/
├── components/     # AiRecipePanel, AuthPanel, Background, Icon, NewRecipeForm, ShortcutsHelp, views
├── context/        # CatalogContext, ConfirmContext, ToastContext
├── hooks/          # useInventory, useRecipes, useCollapsedGroups, useIsMobile,
│                   useGlobalKeys, useSpatialNav, useListKeyboardNav, useFocusTrap
├── lib/            # api.js, inventory.js, recipes.js, units.js, keyboard.js
├── pages/          # Home.jsx
└── constants/      # pantryCatalog.js, units.js
```

## Commands

```bash
# Backend (port 3000)
cd backend && npm run dev
npm test              # vitest run
npm run db:setup       # migrate + seed (a seed upsertel: hozzáad/frissít, nem töröl)
npm run seed:reset     # TRUNCATE + újratöltés — ez a destruktív út, explicit kérésre

# Frontend (port 5173)
cd frontend && npm run dev
npm run lint
npm test
```

## Coding Conventions

- Backend: CommonJS, request body validáció **mindig** `zod`-dal
- Frontend: funkcionális komponensek, hookok (`use*.js`) a state logikára, komponensek csak megjelenítésre
- A Gemini API kulcs **soha** nem kerülhet a frontend bundle-be — csak a backend `.env`-jében élhet
- Két különböző normalizálás van, ne keverd őket:
  - **katalógus-kulcs**: `normalizeCatalogText`. Ez **szándékosan két példányban** él
    (`backend/lib/normalize.js` és `frontend/src/constants/pantryCatalog.js`), mert a
    két workspace nem importál egymásból, a seed írja a kulcsot és a böngésző olvassa.
    A kettőt a `shared/normalizeCatalogText.cases.json` fogja össze: **mindkét**
    tesztkészlet végigjárja, tehát ha csak az egyiket módosítod, a másik oldal CI-je elhasal.
    Új példányt **ne** hozz létre.
  - **mértékegység-kulcs**: `unitLookupKey` (`frontend/src/lib/units.js`) — ez az egyetlen
    hely, ahol egységnév normalizálódik; a `UNIT_ALIASES` kulcsai is ezen mennek át
- A pantry katalógus egységlistája (`frontend/src/constants/units.js` `SYSTEM_UNITS`) és a
  backend AI-enumja (`backend/lib/aiSchemas.js` `AI_ALLOWED_UNITS`) kézi tükör: új egység
  **mindkettőbe** kell, aliast viszont az enumba soha
- CRUD a recept/hűtő/bevásárlólista adatokon a Firestore-on át megy közvetlenül a kliensről, **nem** az Express API-n keresztül

## Important Notes

- `.env` és `.env.local` fájlokat soha ne commitolj
- `archive/` a régi Docker Compose + Nginx demó, **nem** az aktuális futtatási mód — ne vedd figyelembe új funkcióknál
- Render (backend) 15 perc inaktivitás után leáll, 30-60s-et alszik felébredéskor — ez csak a katalógus-fetchet és az első AI hívást érinti
- Teljes deploy-lépések: `.local_directory/DEPLOY.md` (helyi, nincs a repóban)
