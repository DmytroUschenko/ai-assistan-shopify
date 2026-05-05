# Architecture & Environment

## Project Architecture

Single-container application (via **supervisord**) with two co-located services:

- **Frontend** — Remix + React on port 3000 (Shopify embedded app, OAuth, settings UI)
- **Backend** — NestJS on port 3001 (configuration registry, shop management — **internal-only, never exposed externally**)
- **Postgres** — Separate container, backend database for shops and configurations
- **SQLite** — Frontend session database (Prisma ORM)

```
Browser → Remix (3000, public) → [server-side] backend.server.ts → NestJS (3001, localhost) → Postgres
```

## Security Model

- All frontend-to-backend calls are **HMAC-signed** using `SHOPIFY_API_SECRET` (matches Shopify webhook signing)
- Backend validates HMAC in `ShopifyHmacGuard` before processing
- `x-request-hmac` header required on all POST/PUT/DELETE requests (GET requests do not require HMAC)

## Environment Variables

### Frontend requires:
- `SHOPIFY_API_KEY` — From Shopify Partner Dashboard
- `SHOPIFY_API_SECRET` — From Shopify Partner Dashboard (must match backend)
- `APP_URL` — Public HTTPS URL (production domain or ngrok tunnel for local)
- `SCOPES` — Shopify app permissions (comma-separated)
- `DATABASE_URL` — SQLite path: `file:/app/frontend/data/app.db` (Docker) or `file:./data/app.db` (local)
- `BACKEND_URL` — Backend API: `http://localhost:3001` (Docker) or `http://127.0.0.1:3001` (local)

### Backend requires:
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` — Postgres connection
- `PORT` — Backend port (default: 3001)
- `NODE_ENV` — `development` or `production`
- `ALLOWED_ORIGINS` — CORS whitelist (comma-separated URLs)
- `SHOPIFY_API_SECRET` — Must match frontend (used for HMAC validation)

**Critical:** `SHOPIFY_API_SECRET` must be identical in both services. Frontend signs requests; backend verifies.

## Shopify App Configuration Files

- **`shopify.app.local.toml`** — Development app credentials (copied to `shopify.app.toml` in debug builds)
- **`shopify.app.prod.toml`** — Production app credentials (copied to `shopify.app.toml` in prod builds)
- **`shopify.app.toml`** — Generated at runtime, do NOT commit (ignored in `.gitignore`)

### Local ngrok Development Setup

1. Update `shopify.app.local.toml` with ngrok URL
2. Update `.env` with same ngrok URL in `APP_URL`
3. Both must match for OAuth callback to work

## Deployment Parity Rule (Critical)

**Every configuration change must be applied to BOTH environments:**

Production:
- `Dockerfile` (multi-stage build)
- `docker-compose.yml`
- `supervisord.conf`

Debug:
- `Dockerfile.debug` (with Node inspectors)
- `docker-compose.debug.yml` (mounts source code)
- `supervisord.debug.conf` (with Node inspectors)

**Only intentional difference:** `--inspect` flags in debug mode for Node debugging.

**Checklist before committing:**
- [ ] Both Dockerfiles have same build logic (except --inspect)
- [ ] Both docker-compose files have same ENV variables
- [ ] Both supervisor configs start services in same order
- [ ] New dependencies added to both `backend/package.json` and `frontend/package.json`
