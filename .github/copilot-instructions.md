# Copilot Instructions

## Architecture Overview

Single-container application with two co-located services managed by **supervisord**:

- **Frontend** — Remix + React on port 3000 (Shopify embedded app, OAuth, settings UI)
- **Backend** — NestJS on port 3001 (config registry, shop management — **internal only, not exposed**)
- **Postgres** — separate container, used by the backend
- **SQLite** — used by the frontend for Shopify session storage via Prisma

```
Browser → Remix (3000) → [server-side] backend.server.ts → NestJS (3001, localhost) → Postgres
```

All frontend-to-backend calls are **HMAC-signed** using `SHOPIFY_API_SECRET`. The backend validates every request with `ShopifySessionGuard` before processing. Port 3001 must never be exposed externally.

## Build & Test Commands

### Frontend (`cd frontend`)
```bash
npm run dev          # Dev with hot reload (requires Shopify CLI)
npm run build        # Production build
npm start            # Serve production build
npm run setup        # prisma db push && prisma generate
npm test             # All tests (Vitest)
npm test -- app/routes/app._index.tsx  # Single test file
```

### Backend (`cd backend`)
```bash
npm run start:dev    # Watch mode
npm run build        # Production build
npm start            # Serve production build
npm test             # All tests (Jest)
npm run test:e2e     # E2E tests
npm test -- config-registry.service   # Single test file
npm run migration:generate -- src/migrations/DescriptiveName
npm run migration:run
npm run migration:revert
```

### Docker / Deployment (project root)
```bash
make deploy-local            # Start debug stack (FE + BE + Postgres)
make deploy-local FULL=1     # Full reset: wipe volumes, rebuild from scratch
make local-stop              # Stop containers
make local-logs              # Tail all container logs
make local-shell-fe          # Shell into container at /app/frontend
make local-shell-be          # Shell into container at /app/backend
make deploy-prod             # Start production stack
make clean                   # Remove all containers and volumes
```

Node inspectors are available in debug mode: frontend on `9229`, backend on `9230`.

## Key Conventions

### Config Registry Pattern
The backend uses a central `ConfigRegistryService` where modules register their default configs at startup via `onModuleInit()`. Configs are stored as flat dot-path rows in Postgres (`shopId`, `path`, `value`) and merged with in-memory defaults on read.

To add a new config field:
1. Register it in `backend/src/config-registry/config-registry.service.ts` → `onModuleInit()`
2. Provide `ConfigNamespaceMeta` with `fieldType: 'toggle' | 'select' | 'text' | 'number'`; `select` fields **must** include `options`
3. Read/write it from the FE using `getBackendConfig(shop, 'namespace.group.key')` / `setBackendConfig(...)` in `frontend/app/backend.server.ts`

Config paths are always dot-notation: `namespace.group.key` (e.g. `ai_assistant.general.enable`).

### HMAC Security
- GET requests: no HMAC header required
- POST/PUT/DELETE requests: body is signed with `SHOPIFY_API_SECRET` and sent as `x-request-hmac` header
- The guard lives in `backend/src/auth/guards/shopify-hmac.guard.ts`

### Deployment Parity Rule
Every config change must be applied to **both** prod and debug environments:
- `Dockerfile` + `docker-compose.yml` + `supervisord.conf` (prod)
- `Dockerfile.debug` + `docker-compose.debug.yml` + `supervisord.debug.conf` (debug)

The only intentional difference is `--inspect` flags in debug mode.

### Remix Route Conventions
Routes are in `frontend/app/routes/`. The settings page (`app._index.tsx`) uses Remix's `loader` + `action` pattern — loaders fetch config server-side, actions handle form submissions server-side. Both call the backend via `backend.server.ts`, never directly from the browser.

### Backend NestJS Conventions
- All controllers under `ConfigController` are guarded by `@UseGuards(ShopifySessionGuard)`
- Route ordering matters: static segments (e.g. `schema`) are declared before parameterized ones (e.g. `:shopId`) to avoid mismatches
- DTOs use `class-validator` decorators; `ValidationPipe` is global with `whitelist: true, forbidNonWhitelisted: true`
- TypeORM migrations live in `backend/src/database/migrations/`

## Environment Variables

Frontend requires: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `APP_URL`, `SCOPES`, `DATABASE_URL`, `BACKEND_URL`

Backend requires: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`, `SHOPIFY_API_SECRET`

`SHOPIFY_API_SECRET` must match in both services — the frontend uses it to sign requests, the backend uses it to verify them.
