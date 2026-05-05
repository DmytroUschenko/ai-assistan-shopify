# Chat Assistant — Master Plan and Delivery Record

## Purpose
Track what was planned, what changed during implementation, and why decisions were made.

## Current Direction
Embedded application approach is active.

Shopify admin extension approach is postponed and removed from the current codebase. The extension exploration remains documented only as decision history.

## Platform Constraint (Key)
Shopify does not allow third-party apps to inject a persistent floating button across all native admin pages.

Impact:
- Floating assistant is possible inside embedded app routes.
- Native admin pages require extension surfaces (actions/blocks), not global overlays.

## Current Architecture

```
Shopify Admin
├── Embedded app routes (/app/*)
│   └── Floating chat widget (FAB + sidebar)

Shared mock endpoint
└── POST /api/chat (Remix resource route)
```

## Phase Status

### Phase 0 — Mock Chat API
Status: Completed.

What changed:
- Added `frontend/app/routes/api.chat.tsx`.

Why:
- Needed stable frontend contract before backend AI orchestration was ready.

### Phase 1 — Embedded App Floating Assistant
Status: Completed.

What changed:
- Added `frontend/app/components/ChatWidget/` components.
- Wired widget in `frontend/app/routes/app.tsx`.

Why:
- Fastest path to validate UX and chat interaction inside controlled iframe context.

### Phase 2 — Admin Extensions in Shopify Native UI
Status: Postponed.

What changed:
- Extension exploration was removed from the active codebase.

Why changed from initial plan:
- Team decided to focus on the embedded application experience first.
- Extension surfaces added delivery and maintenance overhead before backend assistant behavior was ready.
- Current product direction favors validating the assistant inside the application surface before expanding to native admin placements.

## Decisions Log

1. Keep embedded floating assistant.
Reason: best UX inside app surface and no platform restrictions.

2. Postpone admin extension rollout.
Reason: prioritize application-first delivery and reduce surface-area complexity.

3. Use mock endpoint for active app surface.
Reason: consistent UI testing while backend AI is pending.

## Remaining Work

- Replace mock `/api/chat` with backend AI endpoint.
- Add richer app-surface prompts and assistant actions.
- Add persistence/history and streaming responses.

## Deferred Work

- Revisit Shopify admin extensions after the embedded assistant and backend AI flow are stable.
- Reassess which admin surfaces justify extension investment based on actual merchant usage.
