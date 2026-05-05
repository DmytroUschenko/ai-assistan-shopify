# Frontend Conventions

## File Structure

```
frontend/
├── app/
│   ├── db.server.ts                 # Prisma client (SQLite)
│   ├── shopify.server.ts            # Shopify app config & OAuth
│   ├── backend.server.ts            # HMAC-signed requests to backend
│   └── routes/
│       ├── auth.$.tsx               # OAuth flow
│       └── app._index.tsx           # Settings page (AI Assistant config)
├── prisma/
│   └── schema.prisma                # SQLite schema (session storage)
└── server.js                        # Remix production server
```

## Key Patterns

### Route Convention
- **Routes in:** `frontend/app/routes/`
- **Settings page:** `app._index.tsx` (uses Remix `loader` + `action`)
- **OAuth flow:** `auth.$.tsx` (catch-all route for callback)

### Server-Side Data Fetching
Remix uses `loader` for GET and `action` for mutations (POST/PUT/DELETE):

```tsx
// ✅ Correct: Server-side fetch in loader
export const loader = async ({ request, context }) => {
  const shop = context.shop;
  const configValue = await getBackendConfig(shop, 'ai_assistant.general.enable');
  return json({ configValue });
};

// ✅ Correct: Server-side save in action
export const action = async ({ request, context }) => {
  if (request.method === 'POST') {
    const formData = await request.formData();
    await setBackendConfig(shop, 'ai_assistant.general.enable', formData.get('value'));
    return json({ success: true });
  }
};
```

### Backend Communication
All frontend-to-backend calls go through `backend.server.ts` with HMAC signing:

```typescript
// In frontend/app/backend.server.ts
export async function getBackendConfig(shop: string, path: string) {
  const response = await fetch(`http://localhost:3001/config/${shop}/${path}`, {
    headers: {
      // HMAC signature added here
      'x-request-hmac': hmacSignature,
    },
  });
  return response.json();
}

export async function setBackendConfig(shop: string, path: string, value: unknown) {
  const response = await fetch(`http://localhost:3001/config/${shop}/${path}`, {
    method: 'POST',
    headers: {
      'x-request-hmac': hmacSignature,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });
  return response.json();
}
```

### Session Storage (Prisma + SQLite)
- Frontend uses Prisma ORM for SQLite session storage
- Shopify app integration: `@shopify/shopify-app-session-storage-prisma`
- Session data branches with the database

### Settings Page Pattern
The settings page (`app._index.tsx`) uses the config registry pattern:

1. **Loader** fetches current config from backend
2. **Form** displays toggles/fields from metadata
3. **Action** saves changes back to backend
4. **Metadata** tells frontend how to render each config option

## Testing

```bash
cd frontend
npm test                     # Vitest unit tests
npm test -- app/_index.tsx   # Single file
npm test -- --watch         # Watch mode
```

## Commands

```bash
npm run dev          # Dev server with hot reload (requires Shopify CLI)
npm run dev:local    # Alternative without Shopify CLI
npm run build        # Production build
npm test             # All tests (Vitest)
```

## No Direct Backend Calls from Browser

❌ **Wrong:** Browser makes direct fetch to NestJS
```typescript
const response = await fetch('http://backend:3001/config/shop');
```

✅ **Right:** Browser calls Remix loader, which calls backend server-side
```typescript
// In loader (server-side)
const config = await getBackendConfig(shop, 'ai_assistant.general.enable');
```

This ensures:
- HMAC signatures are applied (only backend can forge valid HMAC)
- Port 3001 stays internal (never exposed to browser)
- Session management stays server-side
