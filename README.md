# Smart Kitchen

> A full-stack AI-powered kitchen assistant — manage your fridge, discover recipes, and generate shopping lists, all in one place.

[![React][React-badge]][React-url]
[![Vite][Vite-badge]][Vite-url]
[![Node.js][Node-badge]][Node-url]
[![Express][Express-badge]][Express-url]
[![PostgreSQL][PG-badge]][PG-url]
[![Docker][Docker-badge]][Docker-url]
[![Firebase][Firebase-badge]][Firebase-url]
[![Gemini][Gemini-badge]][Gemini-url]

---

<p>
  <img src="images/smartkitchenreceptor.png" alt="Architecture" width="600"/>
</p>

## Table of Contents

- [About The Project](#about-the-project)
  - [Built With](#built-with)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## About The Project

Smart Kitchen is a full-stack web application that helps you manage your household kitchen. You can track what is currently in your fridge, browse and save recipes, build a shopping list, and use **Google Gemini AI** to get intelligent recipe suggestions based on the ingredients you already have at home.

The entire stack runs inside Docker via Docker Compose. Nginx acts as a reverse proxy and load-balancer across two Node.js backend instances to demonstrate horizontal scaling. The React frontend is served as pre-built static files through the same Nginx container.

**Key features:**

- **Fridge tracker** — add, remove and update ingredients with amounts and units
- **Recipe manager** — browse and save your own recipes
- **AI recipe suggestions** — Gemini analyses your fridge contents and proposes what you could cook
- **AI recipe generation by name** — describe any dish and get a full recipe in seconds
- **AI recipe from fridge** — generate a recipe that uses only the ingredients you have
- **Shopping list** — maintain and manage a list of items to buy
- **Firebase Authentication** — Google sign-in, no password management needed
- **Load balancing** — two backend replicas behind Nginx for resilience

### Built With

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Firebase Auth, GSAP, Three.js, Motion, Matter.js |
| Backend | Node.js 22, Express 5, `@google/generative-ai` (Gemini), `pg` |
| Database | PostgreSQL 16 |
| Infra | Nginx 1.27 (reverse proxy + load balancer), Docker Compose |
| Auth | Firebase Authentication |
| AI | Google Gemini (`gemini-2.0-flash`) |

---

## Architecture


<p>
  <img src="images/architecture.png" alt="Architecture" width="400"/>
</p>


**Docker services (`docker-compose.yml`):**

| Service | Image / Build | Port |
|---|---|---|
| `nginx` | `nginx:1.27-alpine` | `80` (host) |
| `backend1` | `./backend` Dockerfile | `3000` (host + internal) |
| `backend2` | `./backend` Dockerfile | internal only |
| `postgres` | `postgres:16-alpine` | internal only |

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running in **Linux containers** mode
- [Node.js](https://nodejs.org/) (v18 or later) — needed to build the frontend on the host machine
- A **Google Gemini API key** — get one free at [Google AI Studio](https://aistudio.google.com/app/apikey)
- A **Firebase project** — create one at [Firebase Console](https://console.firebase.google.com/) and enable **Google sign-in** under Authentication

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/your_username/smart-kitchen.git
cd smart-kitchen
```

**2. Create environment files**

```powershell
# Windows PowerShell
Copy-Item compose.env.example compose.env -Force
Copy-Item frontend/.env.local.example frontend/.env.local -Force
```

```bash
# Linux / macOS
cp compose.env.example compose.env
cp frontend/.env.local.example frontend/.env.local
```

**3. Fill in `compose.env`**

Open `compose.env` and set your Gemini credentials. Everything else can be left as-is for local development.

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
```

**4. Fill in `frontend/.env.local`**

Open `frontend/.env.local` and add your Firebase project configuration (from the Firebase Console → Project Settings → Your apps).

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

**5. Build the frontend**

Nginx serves the React app as pre-built static files from `frontend/dist`.

```bash
cd frontend
npm install
npm run build
cd ..
```

**6. Start the full stack**

```bash
docker compose up --build -d
```

Check that all four containers are running:

```bash
docker compose ps
```

The application is now available at **http://localhost**.

---

## Usage

Open **http://localhost** in your browser. You will be prompted to sign in with Google.

After signing in you can:

- **Fridge** tab — add items with name, amount and unit; remove items when used up
- **Recipes** tab — view saved recipes; add a new recipe manually
- **Shopping List** tab — add items you need to buy; check them off as you shop
- **AI Panel** — click "Suggest from fridge" to get Gemini-powered meal ideas based on what you have; select a suggestion to generate the full recipe; or type any dish name to get a recipe on demand

### Helper scripts

```bash
# Tail logs of all containers
bash scripts/logs.sh

# Restart all containers without rebuilding
bash scripts/restart.sh
```

### Load-balancing demo

The two backend instances each report their own container name in the health response. Run the health endpoint several times to see Nginx round-robining between `backend1` and `backend2`:

```powershell
# PowerShell
1..8 | ForEach-Object { (Invoke-WebRequest http://localhost/api/db/health -UseBasicParsing).Content }
```

```bash
# bash
for i in {1..8}; do curl -s http://localhost/api/db/health; echo; done
```

### Stopping the stack

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # full reset including the database volume
```

---

## API Endpoints

All routes are prefixed with `/api/` and proxied by Nginx.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/db/health` | Health check (returns instance name) |
| `GET` | `/api/db/items` | List demo items from PostgreSQL |
| `POST` | `/api/db/items` | Create a demo item |
| `GET` | `/api/fridge` | Get all fridge items |
| `POST` | `/api/fridge` | Add a fridge item |
| `DELETE` | `/api/fridge/:id` | Remove a fridge item |
| `GET` | `/api/recipes` | Get all recipes |
| `POST` | `/api/recipes` | Save a recipe |
| `DELETE` | `/api/recipes/:id` | Delete a recipe |
| `GET` | `/api/shopping-list` | Get shopping list |
| `POST` | `/api/shopping-list` | Add item to shopping list |
| `DELETE` | `/api/shopping-list/:id` | Remove item from shopping list |
| `POST` | `/api/ai/suggest-from-fridge` | Get AI meal suggestions from fridge contents |
| `POST` | `/api/ai/recipe-from-fridge` | Generate full recipe using only fridge items |
| `POST` | `/api/ai/recipe-by-name` | Generate full recipe by dish name |

A ready-to-use REST Client test file is included at `restclient-test.http` (compatible with the VS Code REST Client extension).

---

## Roadmap

- [ ] Automated tests (unit + integration) for backend routes
- [ ] Frontend component tests (Vitest + Testing Library)
- [ ] User-specific data in PostgreSQL (currently per-user data is stored in-memory / JSON)
- [ ] Expiry date tracking for fridge items
- [ ] Cloud deployment (Render / Railway) with public demo link
- [ ] Dark / light theme toggle

---


<!-- Badge links -->
[React-badge]: https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[Vite-badge]: https://img.shields.io/badge/Vite_7-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vite.dev/
[Node-badge]: https://img.shields.io/badge/Node.js_22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[Express-badge]: https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white
[Express-url]: https://expressjs.com/
[PG-badge]: https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white
[PG-url]: https://www.postgresql.org/
[Docker-badge]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://www.docker.com/
[Firebase-badge]: https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black
[Firebase-url]: https://firebase.google.com/
[Gemini-badge]: https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white
[Gemini-url]: https://ai.google.dev/
