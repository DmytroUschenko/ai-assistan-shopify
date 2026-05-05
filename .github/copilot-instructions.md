# Copilot Instructions

This guide helps future Copilot sessions work effectively in this Shopify AI Assistant repository.

**🎯 Quick Reference:**
- **Working on `/backend/`?** Use **`nestjs-best-practices` skill** for all changes. See `.github/instructions/backend.md` for detailed patterns.
- **Working on `/frontend/`?** Follow Remix + React conventions below.
- **General repo structure?** See Architecture Overview below.

## Architecture Overview

Single-container application (via **supervisord**) with two co-located services:

- **Frontend** — Remix + React on port 3000 (Shopify embedded app, OAuth, settings UI)
- **Backend** — NestJS on port 3001 (configuration registry, shop management — **internal-only, never exposed externally**)
- **Postgres** — Separate container, backend database for shops and configurations
- **SQLite** — Frontend session database (Prisma ORM)

```
Browser → Remix (3000, public) → [server-side] backend.server.ts → NestJS (3001, localhost) → Postgres
```

**Security Model (two distinct auth mechanisms):**
- **Config endpoints** (`/config/*`) — protected by `ShopifySessionGuard`: validates a Shopify session JWT from `Authorization: Bearer <token>`
- **Shop registration** (`POST /shops`) — protected by `ShopifyHmacGuard`: validates HMAC signature in `x-request-hmac` (internal FE→BE) or `x-shopify-hmac-sha256` (Shopify webhooks)
- Backend port 3001 is **never exposed externally** — only reachable from the frontend server process inside the same container

## Build, Test & Development Commands

### Frontend (`cd frontend`)

Development and testing:
```bash
npm run dev          # Dev server with hot reload (requires Shopify CLI installed)
npm run dev:local    # Alternative: Remix watch + Node server watch (without Shopify CLI)
npm run build        # Production build
npm start            # Serve production build (requires `npm run build` first)
npm run setup        # prisma migrate dev && prisma generate (initialize DB)
npm test             # All tests (Vitest)
npm test -- app/routes/app._index.tsx  # Single test file
```

### Backend (`cd backend`)

Development and testing:
```bash
npm run start:dev    # Watch mode (auto-reload on file changes)
npm run start:debug  # Debug mode with Node inspector on port 9230
npm run build        # Production build
npm start            # Serve production build (requires `npm run build` first)
npm test             # All tests (Jest)
npm test -- config-registry.service  # Single test file
npm test:e2e         # End-to-end tests
npm run migration:generate -- src/migrations/DescriptiveName  # Generate migration
npm run migration:run    # Apply pending migrations
npm run migration:revert # Revert last migration
```

### Docker & Deployment (project root)

```bash
make deploy-local            # Start debug stack (FE + BE + Postgres, code mounts)
make deploy-local FULL=1     # Full reset: wipe volumes, rebuild, reinstall deps
make deploy-prod             # Start production stack (docker-compose.yml)
make local-stop              # Stop debug containers
make local-logs              # Tail all logs (all services)
make local-shell-fe          # SSH into container, cd to /app/frontend
make local-shell-be          # SSH into container, cd to /app/backend
make clean                   # Remove all containers and volumes
make help                    # Show all available commands
```

**Node Inspectors (debug mode only):**
- Frontend: `localhost:9229`
- Backend: `localhost:9230`
- Connect via VS Code Run menu or Chrome `chrome://inspect`

**No linting/formatting tools** — this project does not include ESLint, Prettier, or similar tools.

## Key Conventions

### Config Registry Pattern (Critical)

The backend uses a **central config registry** where all feature toggles and configurations are registered at startup:

**How it works:**
1. Modules register defaults in `backend/src/config-registry/config-registry.service.ts` → `onModuleInit()`
2. Configs stored as flat dot-path rows in Postgres: `(shopId, path, value)`
3. Reads merge in-memory defaults with per-shop overrides from DB
4. Frontend can read/write via HMAC-signed requests

**Adding a new config field:**
1. Register in `ConfigRegistryService.onModuleInit()`:
   ```typescript
   this.register('ai_assistant', {
     general: {
       enable: true,
       newField: defaultValue,  // Add here
     }
   }, {
     moduleLabel: 'AI Assistant',
     fields: {
       'general.newField': {  // Must match dot-notation path
         groupLabel: 'General',
         keyLabel: 'New Field Label',
         fieldType: 'toggle', // or 'select'|'text'|'number'
         options: [...],      // Required only for 'select'
       },
     },
   });
   ```
2. Add metadata for FE rendering (see `config-meta.types.ts`)
3. Read from FE via: `getBackendConfig(shop, 'ai_assistant.general.newField')`
4. Write from FE via: `setBackendConfig(shop, 'ai_assistant.general.newField', value)`
5. Frontend calls in `frontend/app/backend.server.ts`

**Convention:** Config paths are always dot-notation: `namespace.group.key` (e.g., `ai_assistant.general.enable`)

### Frontend (Remix + Prisma)

**Route Location:** `frontend/app/routes/`
- `auth.$.tsx` — OAuth flow (Shopify Admin redirect)
- `app._index.tsx` — Settings page (AI Assistant config UI)

**Pattern:** Use Remix `loader` (fetch server-side) + `action` (handle submissions server-side)
- **Never** call backend directly from browser
- Always call via `backend.server.ts` (server-side fetch with HMAC signing)
- Example: `loader` fetches config, `action` saves config via backend

**Prisma:** SQLite session storage via `@shopify/shopify-app-session-storage-prisma`

### Backend (NestJS)

**Guard Pattern:** Two guards, applied per-controller via `@UseGuards()` (NOT global):
- `ShopifySessionGuard` — validates Shopify session JWT (`Authorization: Bearer <token>`); used on config controller
- `ShopifyHmacGuard` — validates HMAC signature; used on shop registration (`POST /shops`); accepts `x-request-hmac` (internal) or `x-shopify-hmac-sha256` (Shopify webhooks)
- Guard sources: `backend/src/auth/guards/`

**Route Ordering:** Static segments must be declared BEFORE parameterized ones
- ❌ Wrong: `/:shopId`, `/schema` (schema will never match)
- ✅ Right: `/schema`, `/:shopId` (static routes first)

**Validation:**
- DTOs use `class-validator` decorators for field validation
- Global `ValidationPipe` configured: `whitelist: true, forbidNonWhitelisted: true`
- Invalid requests rejected before reaching handlers

**Database Migrations:**
- TypeORM migrations live in: `backend/src/database/migrations/`
- Migrations auto-run on container startup via supervisor
- Manual: `npm run migration:run`, `npm run migration:revert`

### Deployment Parity Rule (Critical)

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

### Shopify App Configuration Files

- **`shopify.app.local.toml`** — Development app credentials (copied to `shopify.app.toml` in debug builds)
- **`shopify.app.prod.toml`** — Production app credentials (copied to `shopify.app.toml` in prod builds)
- **`shopify.app.toml`** — Generated at runtime, do NOT commit (ignored in `.gitignore`)

For local ngrok development:
1. Update `shopify.app.local.toml` with ngrok URL
2. Update `.env` with same ngrok URL in `APP_URL`
3. Both must match for OAuth callback to work

## Common Workflows

### Local Development Setup

```bash
# Copy template and update credentials
cp .env.example .env
# Edit .env with your Shopify app credentials and URLs

# Start debug stack (mounts code for hot reload)
make deploy-local

# In another terminal, tail logs
make local-logs

# Access app at http://localhost:3000
```

### Adding a New Feature with Config Toggle

1. Register config in backend:
   ```bash
   # In backend/src/config-registry/config-registry.service.ts onModuleInit()
   this.register('ai_assistant', {
     features: { newFeature: false }
   }, { fields: { 'features.newFeature': { fieldType: 'toggle' } } });
   ```

2. Add UI to settings page:
   ```tsx
   // In frontend/app/routes/app._index.tsx loader()
   const newFeatureEnabled = await getBackendConfig(shop, 'ai_assistant.features.newFeature');
   ```

3. Test locally:
   ```bash
   make deploy-local
   # Browse to http://localhost:3000 → Settings
   # Toggle should appear and persist on reload
   ```

### Debugging Backend

```bash
# Start with Node inspector
make deploy-local
make local-logs

# Connect debugger:
# VS Code: Run → Connect to Process → localhost:9230
# Chrome: chrome://inspect → Remote Target localhost:9230

# Set breakpoints and step through code
```

### Database Migrations

```bash
cd backend

# Generate migration from entity changes
npm run migration:generate -- src/migrations/AddNewFeature

# Review generated migration file, then apply
npm run migration:run

# Rollback if needed
npm run migration:revert
```

### Resetting Everything

```bash
# Remove containers and volumes, rebuild from scratch
make clean
make deploy-local FULL=1
```
