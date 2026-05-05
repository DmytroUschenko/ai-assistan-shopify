# Phase 2 Outcomes — Shopify Admin Extension Surfaces

## Status
Delivered incrementally and validated in local Shopify dev flow.

## Objective
Expose assistant entry points in Shopify native admin pages where platform permits, while keeping embedded assistant from Phase 1.

## What Was Implemented
- Admin Action extension (product details):
  - Surface: `admin.product-details.action.render`
  - Entry point appears in page actions ("More actions").

- Admin Block extensions (visible page UI):
  - Product details block: `admin.product-details.block.render`
  - Order details block: `admin.order-details.block.render`
  - Customer details block: `admin.customer-details.block.render`

## Why This Shape
- A global floating button across all Shopify admin pages is not supported for third-party apps.
- "Not under More actions" requirement was addressed by adding visible admin blocks on key detail pages.
- One-target-per-extension model provided stable compatibility with Shopify CLI workflow.

## Key Changes
- Added extension directories:
  - `frontend/extensions/ai-assistant/`
  - `frontend/extensions/ai-assistant-product-block/`
  - `frontend/extensions/ai-assistant-order-block/`
  - `frontend/extensions/ai-assistant-customer-block/`
- Standardized extension implementation to scaffold-compatible Preact components.
- Reused shared chat contract to backend mock route (`POST /api/chat`).

## Validation Notes
- `shopify app info --config shopify.app.local.toml` recognizes all extension directories.
- Assistant entries are available on configured admin page surfaces.

## Remaining Gaps
- Real AI backend integration (still mock responses).
- Rich page-context prompts and actions.
- Cross-surface conversation continuity.
- Production rollout/versioning checklist per environment.
