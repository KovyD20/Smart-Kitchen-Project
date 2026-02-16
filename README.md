# Smart Kitchen Docker Demo

## 1. Prerequisites
- Docker Desktop running (Linux containers mode)
- Node.js installed (for frontend build)

## 2. Environment files (clear naming)
- `compose.env` -> Docker Compose + backend-in-container variables
- `frontend/.env.local` -> frontend (Vite) Firebase variables

Create from examples:
```powershell
Copy-Item compose.env.example compose.env -Force
Copy-Item frontend/.env.local.example frontend/.env.local -Force
```

Fill these before AI routes:
```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
```

## 3. Build frontend (host machine)
Nginx serves static files from `frontend/dist`.

```powershell
cd frontend
npm install
npm run build
cd ..
```

## 4. Start infrastructure
```powershell
docker compose --env-file compose.env up --build -d
```

Check containers:
```powershell
docker compose --env-file compose.env ps
```

## 5. Quick API tests (through Nginx)
DB health:
```powershell
(Invoke-WebRequest http://localhost/api/db/health -UseBasicParsing).Content
```

DB list:
```powershell
(Invoke-WebRequest http://localhost/api/db/items -UseBasicParsing).Content
```

Create item:
```powershell
$body = @{ name = "demo-item" } | ConvertTo-Json
(Invoke-WebRequest http://localhost/api/db/items -Method POST -Body $body -ContentType "application/json" -UseBasicParsing).Content
```

## 6. Show load balancing
Run health multiple times and watch instance change (`backend1` / `backend2`):
```powershell
1..8 | ForEach-Object { (Invoke-WebRequest http://localhost/api/db/health -UseBasicParsing).Content }
```

## 7. Enter containers and check processes
Backend container:
```powershell
docker compose --env-file compose.env exec backend1 sh
ps aux | head -n 10
exit
```

Nginx container:
```powershell
docker compose --env-file compose.env exec nginx sh
ps aux | head -n 10
exit
```

Postgres query:
```powershell
docker compose --env-file compose.env exec postgres psql -U smart_user -d smart_kitchen -c "SELECT id, name, created_at FROM demo_items ORDER BY id DESC;"
```

## 8. Stop infrastructure
```powershell
docker compose --env-file compose.env down
```

Full reset:
```powershell
docker compose --env-file compose.env down -v
```
