# Local Development Setup

This guide covers two approaches for local development:
1. **Docker-based** (recommended for most) — Quick startup, no dependency management
2. **Local services** (advanced) — Instant hot reload, full control

## Quick Overview

The AI Assistant Shopify app is a **single-container** application with:
- **Frontend** (Remix) on port 3000 (or ngrok proxy)
- **Backend** (NestJS) on port 3004 (internal-only)
- **Postgres** database

For Shopify OAuth to work, you **must** use a public HTTPS URL (ngrok).

---

## Option 1: Docker-Based Setup (Recommended) ⚡

Fastest way to get up and running. Everything runs in Docker containers.

### Prerequisites

- Git
- Docker & Docker Compose
- ngrok (free tier account at https://ngrok.com)
- Shopify Partner account with a test store
- Node.js/npm (for running ngrok, not the app)

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone <repo-url> ai_assistant_shopify
cd ai_assistant_shopify

# Pull latest changes (if already cloned)
git pull
```

### Step 2: Set Up ngrok Tunnel

ngrok provides a public HTTPS URL that proxies to your local port 3000.

```bash
# Terminal 1: Start ngrok tunnel
ngrok http 3000
```

You'll see output like:
```
Session Status                online
Account                       <your-email>
Version                        3.x.x
Region                         us (California)
Latency                         xx ms
Web Interface                http://127.0.0.1:4040
Forwarding                   https://isocratic-gauntly-deane.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS forwarding URL** (e.g., `https://isocratic-gauntly-deane.ngrok-free.app`)

### Step 3: Create Shopify App

1. Go to https://dev.shopify.com/dashboard/131061074
2. Click **"Create an app"**
3. Fill in app name, e.g., "AI Assistant Local Dev"
4. **App URL**: Paste your ngrok HTTPS URL from Step 2
5. **Allowed redirect URLs**: Paste the same URL with `/auth/callback`:
   ```
   https://isocratic-gauntly-deane.ngrok-free.app/auth/callback
   ```
6. Click **"Create app"**
7. Go to **Configuration** tab and copy:
   - **Client ID** → `SHOPIFY_API_KEY`
   - **Client secret** → `SHOPIFY_API_SECRET`

### Step 4: Configure Environment

```bash
# Terminal 2: Configure environment
cd ai_assistant_shopify

# Copy environment template
cp .env.example .env

# Edit .env with your values
```

Edit `.env`:
```env
# From Shopify dashboard
SHOPIFY_API_KEY=<your-client-id>
SHOPIFY_API_SECRET=<your-client-secret>
APP_URL=https://isocratic-gauntly-deane.ngrok-free.app

# Frontend database
DATABASE_URL=file:./data/app.db

# Backend
BACKEND_URL=http://localhost:3004
PORT=3004
NODE_ENV=development

# Backend — Postgres in Docker
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ai_assistant_db
ALLOWED_ORIGINS=http://localhost:3000
```

### Step 5: Create Shopify App Config

```bash
# Copy and fill in Shopify TOML config
cp shopify.app.example.toml frontend/shopify.app.local.toml

# Edit frontend/shopify.app.local.toml
```

Edit `frontend/shopify.app.local.toml`:
```toml
client_id = "<your-client-id>"
name = "ai-assistant-local"
application_url = "https://<your-ngrok-subdomain>.ngrok-free.dev"
embedded = true

[webhooks]
api_version = "2026-04"

[access_scopes]
scopes = "write_products,read_orders"
optional_scopes = []
use_legacy_install_flow = false

[auth]
redirect_urls = [
   "https://<your-ngrok-subdomain>.ngrok-free.dev/auth/callback"
]
```

### Step 6: Start Services

```bash
# Terminal 2: Start full Docker stack (FE + BE + Postgres)
make deploy-local FULL=1
```

This will:
- Remove old containers/volumes
- Build fresh images
- Start frontend on 3000, backend on 3004, postgres
- Apply database migrations automatically

### Step 7: Access Your App

1. Open browser: `https://<your-ngrok-subdomain>.ngrok-free.dev`
2. You'll be redirected to Shopify OAuth login
3. Authorize the app
4. You'll see the Settings page with the AI Assistant toggle

### You're Done! 🎉

The app is now running in Docker with public access via ngrok. Changes to code require Docker rebuild (slower), but no local dependency management.

### Stop Services

```bash
make local-stop
# OR
docker-compose -f docker-compose.debug.yml down
```
