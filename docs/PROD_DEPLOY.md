# Production Deployment Guide

This guide covers deploying the AI Assistant Shopify app to production using Docker.

## Architecture Overview

The app runs as a **single Docker container** with:
- **Frontend**: Remix + React (port 3000) — Shopify embedded app with OAuth
- **Backend**: NestJS (port 3001, internal-only) — Config registry and shop management
- **Postgres**: Separate container — persists shops and configurations
- **Supervisor**: Orchestrates both services within the container

```
┌─────────────────────────────────────┐
│ Docker Container (port 3000)        │
│ ├─ Frontend (Remix)                 │
│ └─ Backend (NestJS)                 │
├─────────────────────────────────────┤
│ Postgres (separate container)       │
└─────────────────────────────────────┘
```

## Pre-Deployment Checklist

- [ ] Production domain registered and HTTPS certificate configured
- [ ] Shopify Partner Dashboard access
- [ ] Shopify API credentials obtained (API Key, API Secret)
- [ ] Docker and Docker Compose installed on production server
- [ ] Postgres backup strategy in place
- [ ] Monitoring/logging system configured (optional but recommended)
- [ ] Git repository with code pushed to production branch
- [ ] All tests passing locally (`npm test` in both frontend and backend)
- [ ] Code reviewed and approved for production

## Step 1: Shopify Partner Dashboard Configuration

### 1.1 Create or Update Your App

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to **Apps and sales channels** → **Apps**
3. Click **Create app** (or select existing app to update)
4. Fill in:
   - **App name**: `ai-assistant` (or your preferred name)
   - **App type**: Select the appropriate type
5. Click **Create app**

### 1.2 Configure Credentials

1. Go to **Configuration** tab
2. Under **Admin API credentials**:
   - Copy **Client ID** → Use for `SHOPIFY_API_KEY` in docker-compose
   - Copy **Client secret** → Use for `SHOPIFY_API_SECRET` in docker-compose
   - **Important**: Save these credentials securely (use your platform's secret management)
3. Under **OAuth redirect URIs**:
   - Click **Add URI**
   - Enter: `https://<your-production-domain.com>/auth/callback`
4. Under **App URL**:
   - Enter: `https://<your-production-domain.com>`
5. **Save** changes

### 1.3 Configure Scopes

1. Go to **Configuration** → **Admin API scopes**
2. Check required scopes (defaults):
   - `write_products`
   - `read_orders`
3. Adjust as needed for your use case
4. **Save**

## Step 2: Prepare Environment Variables

Create a production `.env` file on your server:

```bash
# Frontend (Shopify App)
SHOPIFY_API_KEY=<from Partner Dashboard>
SHOPIFY_API_SECRET=<from Partner Dashboard>
APP_URL=https://<your-production-domain.com>
SCOPES=write_products,read_orders
DATABASE_URL=file:/app/frontend/data/app.db

# Backend
BACKEND_URL=http://localhost:3001
NODE_ENV=production

# Postgres
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=<secure-username>
DB_PASSWORD=<secure-password>
DB_NAME=ai_assistant_db

# CORS (allow FE to communicate with BE)
ALLOWED_ORIGINS=https://<your-production-domain.com>
```

**Security Best Practices**:
- Store `.env` file outside git (add to `.gitignore`)
- Use strong, randomly-generated passwords for Postgres
- Use your platform's secret management (AWS Secrets Manager, Vault, etc.) instead of `.env` in production if possible
- Never commit credentials to git

## Step 3: Deploy Docker Stack

### 3.1 Clone Repository

```bash
cd /opt/apps  # or your preferred deployment directory
git clone <your-repo> ai-assistant
cd ai-assistant
```

### 3.2 Copy and Configure Environment

```bash
# Copy the .env file you created in Step 2
cp /path/to/production.env .env

# Verify docker-compose.yml uses correct environment
cat docker-compose.yml | grep -A 20 "environment:"
```

### 3.3 Build and Start Stack

```bash
# Pull latest code
git pull origin main

# Build and start containers
make deploy-prod

# Wait for services to be ready (check logs)
docker-compose logs -f

# Expected logs:
# app | [supervisord] spawned frontend with pid 1
# app | [supervisord] spawned backend with pid 2
# postgres | database system is ready to accept connections
```

### 3.4 Run Database Migrations

The migrations run automatically on frontend startup (see `supervisord.conf`), but you can verify manually:

```bash
# Check if migrations ran
docker-compose logs app | grep -i "prisma\|migration"

# If needed, manually trigger migrations (should not be necessary)
docker-compose exec app sh -c "cd /app/frontend && NODE_ENV=production ./node_modules/.bin/prisma migrate deploy"
```

## Step 4: Verification

### 4.1 Check Service Health

```bash
# View container status
docker-compose ps

# Expected output:
# NAME     STATUS
# postgres Up X seconds (healthy)
# app      Up X seconds
```

### 4.2 Verify Frontend Access

1. Open browser: `https://<your-production-domain.com>`
2. You should see the Shopify OAuth login page
3. Complete OAuth flow with a test store
4. You should land on the settings page with AI Assistant toggle

### 4.3 Verify Backend Health

```bash
# Check backend is responding (from inside container)
docker-compose exec app curl http://localhost:3001/health

# Expected: 200 OK with JSON response
```

### 4.4 Verify Database Connection

```bash
# Connect to Postgres
docker-compose exec postgres psql -U <DB_USERNAME> -d ai_assistant_db -c "\dt"

# Expected: List of tables (shops, core_configs, etc.)
```

### 4.5 Verify Frontend-Backend Communication

1. Log in to the app at `https://<your-production-domain.com>`
2. Go to settings page
3. Toggle the AI Assistant enable/disable
4. Refresh page — toggle state should persist
5. Check backend logs:
   ```bash
   docker-compose logs app | grep -i "ai_assistant\|config"
   ```

## Step 5: Post-Deployment Configuration

### 5.1 Update Shopify App Settings (if needed)

Return to Partner Dashboard and verify:
- **Application URL**: Points to your production domain
- **Allowed redirect URIs**: Includes your OAuth callback
- **Scopes**: Match your application needs

### 5.2 Configure Webhooks (if needed)

If your app listens to Shopify webhooks:
1. Go to **Configuration** → **Webhooks**
2. Add webhook endpoints (e.g., `/webhooks/products/create`)
3. Note: Current app does not require webhooks for basic functionality

### 5.3 Install App on Test Store

1. Go to Partner Dashboard → **Test apps**
2. Click **Create an app for development**
3. Select your production app
4. Install on test store to verify OAuth flow works

## Step 6: Monitoring and Maintenance

### 6.1 Monitor Logs

```bash
# Tail all logs
docker-compose logs -f

# Tail specific service
docker-compose logs -f app
docker-compose logs -f postgres

# View logs since last restart
docker-compose logs app | tail -100
```

### 6.2 Database Backups

```bash
# Backup Postgres database
docker-compose exec postgres pg_dump -U <DB_USERNAME> ai_assistant_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose exec postgres psql -U <DB_USERNAME> ai_assistant_db < backup_20240101_120000.sql

# **Recommended**: Set up automated daily backups using cron
# Example cron entry (runs daily at 2 AM):
# 0 2 * * * cd /opt/apps/ai-assistant && docker-compose exec postgres pg_dump -U postgres ai_assistant_db > /backups/db_$(date +\%Y\%m\%d).sql
```

### 6.3 Monitor Disk Space

```bash
# Check Docker volumes
docker volume ls
docker volume inspect ai-assistant_pgdata

# Monitor disk usage
df -h /var/lib/docker/volumes

# Clean up old logs (if needed)
docker-compose logs --tail=1000 > /dev/null  # Truncate logs
```

### 6.4 Health Checks

```bash
# Frontend health
curl -s https://<your-production-domain.com> | head -20

# Backend health
docker-compose exec app curl http://localhost:3001/health

# Postgres health
docker-compose exec postgres pg_isready -U <DB_USERNAME>
```

## Step 7: Updating the App

### 7.1 Pull Latest Code

```bash
cd /opt/apps/ai-assistant
git pull origin main
```

### 7.2 Rebuild and Restart

```bash
# Rebuild containers and restart (picks up new code)
make deploy-prod

# Watch logs for startup
docker-compose logs -f
```

### 7.3 Database Migrations

If there are backend database schema changes:

```bash
# Migrations run automatically on startup
docker-compose logs app | grep -i "migration\|migration completed"

# If migration fails, check logs
docker-compose logs app
```

## Step 8: Troubleshooting

### Frontend Can't Connect to Backend

**Symptom**: Settings page loads but can't toggle AI Assistant

**Check**:
```bash
docker-compose logs app | grep -i "backend\|3001\|hmac"
```

**Fix**:
- Verify `BACKEND_URL=http://localhost:3001` in docker-compose.yml
- Check backend is running: `docker-compose ps` → backend should be "Up"
- Check backend logs: `docker-compose logs app | grep "backend\|Backend"`

### OAuth Fails

**Symptom**: Redirect loop or "Invalid redirect URL" error

**Check**:
- Verify `APP_URL` in docker-compose matches Partner Dashboard **Application URL**
- Verify redirect URI in Partner Dashboard: `https://<your-domain>/auth/callback`
- Check browser console for error messages

**Fix**:
```bash
# Update docker-compose.yml with correct APP_URL
# Restart
docker-compose restart app

# Verify logs
docker-compose logs app | grep -i "oauth\|redirect"
```

### Database Connection Errors

**Symptom**: Backend won't start or "ECONNREFUSED" errors

**Check**:
```bash
docker-compose logs postgres | grep "ready\|error"
docker-compose logs app | grep "DB_HOST\|Database"
```

**Fix**:
- Ensure Postgres container is healthy: `docker-compose ps postgres` → status should be "Up"
- Verify credentials match: `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` in docker-compose
- Check Postgres is listening: `docker-compose exec postgres netstat -tuln | grep 5432`

### Out of Disk Space

**Symptom**: Containers fail to start or write errors

**Check**:
```bash
df -h /var/lib/docker
docker system df
```

**Fix**:
```bash
# Remove unused volumes (BACKUP FIRST!)
docker volume prune

# Remove unused images
docker image prune -a

# Clear old logs
truncate -s 0 /var/lib/docker/containers/*/*.log
```

## Step 9: Rollback Procedure

If a deployment fails or causes issues:

```bash
# Stop current deployment
docker-compose down

# Restore database from backup
docker-compose up postgres -d
docker-compose exec postgres psql -U <DB_USERNAME> ai_assistant_db < backup_20240101_120000.sql

# Revert code to previous version
git checkout <previous-commit-hash>

# Restart with previous version
make deploy-prod

# Verify
docker-compose logs -f
```

## Step 10: Scaling and Advanced Configuration

### 10.1 Running Multiple Instances (if needed)

The current single-container design does not support scaling horizontally without refactoring. To scale:
1. Separate frontend and backend into different containers
2. Add a load balancer (nginx, HAProxy)
3. Use persistent session storage (Redis)

This is beyond the scope of this guide; consider consulting with DevOps if needed.

### 10.2 Using External Postgres (AWS RDS, etc.)

To use a managed Postgres instead of Docker Postgres:

1. Update docker-compose.yml to remove `postgres` service
2. Update environment variables:
   ```
   DB_HOST=<your-rds-endpoint>
   DB_PORT=5432
   DB_USERNAME=<rds-username>
   DB_PASSWORD=<rds-password>
   DB_NAME=ai_assistant_db
   ```
3. Restart: `docker-compose up -d`

### 10.3 Custom SSL Certificates

If using self-signed or custom certificates:
1. Place certificates in a volume mount
2. Update supervisor or Remix config to use certificates
3. Ensure `APP_URL` matches certificate domain

## Step 11: Security Hardening

### 11.1 Environment Variables

- [ ] Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
- [ ] Never commit `.env` to git
- [ ] Rotate `SHOPIFY_API_SECRET` periodically
- [ ] Use strong, unique Postgres password

### 11.2 Network Security

- [ ] Expose only port 3000 to the internet
- [ ] Backend port 3001 should be internal-only
- [ ] Use HTTPS only (no HTTP)
- [ ] Consider IP whitelisting if applicable

### 11.3 Database Security

- [ ] Set up automated backups
- [ ] Test restore procedures
- [ ] Monitor database access logs
- [ ] Use strong authentication credentials

### 11.4 Container Security

- [ ] Keep Docker updated
- [ ] Don't run containers as root (current setup uses unprivileged processes)
- [ ] Regularly rebuild containers to patch OS vulnerabilities

## Summary

| Step | Task | Command |
|------|------|---------|
| 1 | Configure Shopify Partner Dashboard | Manual in Partner Dashboard |
| 2 | Create `.env` file | `cp .env.example .env && edit .env` |
| 3 | Deploy stack | `make deploy-prod` |
| 4 | Verify services | `docker-compose ps && docker-compose logs -f` |
| 5 | Test OAuth flow | Visit `https://<domain>` in browser |
| 6 | Monitor | `docker-compose logs -f` |
| 7 | Update | `git pull && make deploy-prod` |

## Support and Troubleshooting

- **Backend logs**: `docker-compose logs app | grep -A 5 "backend\|NestJS"`
- **Frontend logs**: `docker-compose logs app | grep -A 5 "frontend\|Remix"`
- **Database logs**: `docker-compose logs postgres`
- **Full logs**: `docker-compose logs`

For detailed debugging, see `CLAUDE.md` debugging section.
