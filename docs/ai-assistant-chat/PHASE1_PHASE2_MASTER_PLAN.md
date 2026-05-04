# Chat Assistant Widget — Implementation Plan

## Overview

Implement a sidekick-style AI assistant UI for the Shopify embedded app with two surfaces:

1. **Floating sidebar** — persistent within the embedded App Home (`/app/*`), triggered by a FAB button
2. **Admin Action extension** — appears in the "More actions" menu on Products, Orders, and Customers pages; opens a modal chat window

> **Platform constraint:** A truly persistent floating button across *all* Shopify admin pages is architecturally impossible for third-party apps (Shopify's sandbox model blocks cross-page DOM injection). The Admin Action extension is the closest native equivalent.

---

## Architecture

```
Browser (Shopify Admin iframe)
├── /app/* routes (Remix)
│   ├── <ChatWidget />  ← floating FAB + sidebar (position: fixed inside iframe)
│   └── <Outlet />      ← existing page content
│
└── UI Extension (separate Preact bundle, deployed via Shopify CLI)
    ├── admin.product-details.action.render  → modal chat
    ├── admin.order-details.action.render    → modal chat
    └── admin.customer-details.action.render → modal chat

Remix Resource Route
└── POST /api/chat  ← mock endpoint (real AI backend TBD)
```

---

## Phases

### Phase 0 — Mock Chat API
**File:** `frontend/app/routes/api.chat.tsx`

- Remix resource route, responds to `POST`
- Accepts `{ message: string }` in the request body
- Returns `{ reply: string }` with a placeholder response
- Will be swapped for the real AI NestJS endpoint (port 3001) when ready

---

### Phase 1 — Floating Chat Sidebar (App Home)

**Files created:**
- `frontend/app/components/ChatWidget/FloatingButton.tsx` — FAB at bottom-right using Polaris `Button` + `position: fixed` inline styles
- `frontend/app/components/ChatWidget/ChatSidebar.tsx` — sliding panel (right side) using `position: fixed` + CSS `transform: translateX(...)` transition; contains message list + Polaris `TextField` + send `Button`
- `frontend/app/components/ChatWidget/index.tsx` — composes FAB + sidebar, manages `isOpen` state, calls `/api/chat` via Remix `useFetcher`

**File modified:**
- `frontend/app/routes/app.tsx` — renders `<ChatWidget />` alongside `<Outlet />` inside `<AppProvider>`

**UX behaviour:**
- FAB is always visible in the bottom-right corner of the app iframe
- Clicking FAB opens the sidebar with a slide-in animation
- User types a message and clicks Send; the message appears in the list immediately; a mock reply is appended after the fetch resolves
- Sidebar has an X close button

---

### Phase 2 — Admin Action UI Extension

**Directory:** `frontend/extensions/ai-assistant/`

Scaffolded via Shopify CLI:
```bash
cd frontend
shopify app generate extension --template admin_action --name "ai-assistant"
```

**`shopify.extension.toml` targets:**
```toml
[[extensions.targeting]]
target = "admin.product-details.action.render"
module = "./src/AssistantAction.tsx"

[[extensions.targeting]]
target = "admin.order-details.action.render"
module = "./src/AssistantAction.tsx"

[[extensions.targeting]]
target = "admin.customer-details.action.render"
module = "./src/AssistantAction.tsx"
```

**`src/AssistantAction.tsx`:**
- Uses `@shopify/ui-extensions-react/admin` (Preact-based — required for extensions, not React)
- Wraps content in `<AdminAction>` (the modal container)
- Renders a `<BlockStack>` chat layout with a scrollable message list, `<TextField>`, and `<Button>`
- Calls `POST /api/chat` on the app's public URL for mock responses
- Session token passed via `useSessionToken()` (from extensions-react) as `Authorization: Bearer` header — wired but unused by mock

---

## Files Summary

| Action | Path |
|--------|------|
| Create | `frontend/app/routes/api.chat.tsx` |
| Create | `frontend/app/components/ChatWidget/index.tsx` |
| Create | `frontend/app/components/ChatWidget/FloatingButton.tsx` |
| Create | `frontend/app/components/ChatWidget/ChatSidebar.tsx` |
| Modify | `frontend/app/routes/app.tsx` |
| Scaffold (CLI) | `frontend/extensions/ai-assistant/` |
| Modify | `frontend/extensions/ai-assistant/shopify.extension.toml` |
| Create | `frontend/extensions/ai-assistant/src/AssistantAction.tsx` |

---

## Future Work (Out of Scope Now)

- Replace mock `/api/chat` with real NestJS AI endpoint
- Add proper HMAC or session-token auth to `/api/chat`
- Extend Admin Action targets to draft orders, collections, discounts
- Persist chat history (local storage or backend)
- Stream AI responses (SSE / chunked responses)
- Style polish: branded colours, typing indicator, timestamps
