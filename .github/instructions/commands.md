# Build, Test & Development Commands

## Frontend (`cd frontend`)

**Development and testing:**
```bash
npm run dev          # Dev server with hot reload (requires Shopify CLI installed)
npm run dev:local    # Alternative: Remix watch + Node server watch (without Shopify CLI)
npm run build        # Production build
npm start            # Serve production build (requires `npm run build` first)
npm run setup        # prisma migrate dev && prisma generate (initialize DB)
npm test             # All tests (Vitest)
npm test -- app/routes/app._index.tsx  # Single test file
```

## Backend (`cd backend`)

**Development and testing:**
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

## Docker & Deployment (project root)

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
