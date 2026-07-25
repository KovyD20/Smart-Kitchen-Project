# Archive — local Docker / Nginx setup

This folder holds the original **local container orchestration** for the project.
It is kept for reference (it demonstrates the Docker / load-balancing setup) but is
**no longer the active way the app runs**.

## What's here

- `docker-compose.yml` — 4-service stack: Nginx + two backend replicas + Postgres
- `infra/nginx/nginx.conf` — reverse proxy / round-robin load balancer over the two backends
- `infra/postgres/init.sql` — the pantry catalog schema (`pantry_categories`, `pantry_items`, `pantry_aliases`)
- `backend/Dockerfile`, `backend/.dockerignore` — backend image build
- `.env.example` — environment template for the compose stack
- `scripts/*.sh` — helper scripts for the compose workflow

## Why it was archived

Production hosting moved to managed cloud services (see `REFACTOR_TERV.md`, Phase 7):

- **Frontend** → Vercel / Netlify
- **Backend** → Render / Railway
- **PostgreSQL** → Neon / Supabase (managed; the schema in `infra/postgres/init.sql`
  will be applied to the managed database there)
- **Auth + per-user data** → Firebase / Firestore (unchanged)

On managed hosts the platform handles scaling, so the local Nginx load balancer and the
two-replica compose setup are not deployed — they remain here purely as a local /
demonstration setup.
