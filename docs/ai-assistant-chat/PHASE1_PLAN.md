# Phase 1 Plan — Embedded Chat Widget

## Goal
Implement a Sidekick-like assistant entry point inside the embedded app iframe (`/app/*`).

## Scope
- In scope:
  - Floating button (FAB) in embedded app pages
  - Slide-in chat sidebar UI
  - Mock Remix endpoint for chat (`POST /api/chat`)
  - Wiring widget into app layout
- Out of scope:
  - Real AI backend integration
  - Persistent chat history
  - Shopify Admin extension rollout

## Planned File Changes
- Create: `frontend/app/components/ChatWidget/FloatingButton.tsx`
- Create: `frontend/app/components/ChatWidget/ChatSidebar.tsx`
- Create: `frontend/app/components/ChatWidget/index.tsx`
- Create: `frontend/app/routes/api.chat.tsx`
- Update: `frontend/app/routes/app.tsx`

## Technical Notes
- Widget renders inside existing App Bridge provider in `app.tsx`.
- Sidebar uses fixed positioning and z-index to overlay route content.
- Chat requests use Remix `useFetcher` to post JSON to `/api/chat`.
- Mock response format: `{ reply: string }`.

## Exit Criteria
- FAB appears on `/app/*` routes.
- Sidebar opens/closes reliably.
- Submitting text produces mock assistant response in UI.
- No TypeScript/compile errors in Phase 1 files.

## Note
The team later decided to postpone the extension approach and continue with the embedded application surface only for now.
