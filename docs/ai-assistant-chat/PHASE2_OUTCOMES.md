# Phase 2 Outcomes — Shopify Admin Extension Surfaces

## Status
Postponed. The extension experiment was removed from the active codebase.

## Objective
This phase explored assistant entry points in Shopify native admin pages where platform permits.

## What Was Explored
- Admin Action extension (product details).
- Admin Block extensions for product, order, and customer details.

## Why It Was Postponed
- Team decided to prioritize the embedded application experience first.
- Extension-specific delivery added overhead before backend AI behavior was ready.
- Application-only flow is sufficient for current product validation.

## What Was Learned
- A global floating button across all Shopify admin pages is not supported for third-party apps.
- Shopify native entry points require extension surfaces such as actions or blocks.
- Extension rollout is best revisited after assistant behavior, backend integration, and product scope are stable.

## Repository State
- No extension implementation is currently kept in the active codebase.
- Embedded app assistant remains the supported path.

## Revisit Conditions
- Backend AI integration is ready.
- Team wants native Shopify admin entry points again.
- There is a clear business need for product/order/customer page surfaces.
