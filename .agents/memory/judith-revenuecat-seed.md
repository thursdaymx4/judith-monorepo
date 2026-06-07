---
name: Judith RevenueCat seed
description: How RC backend is seeded and wired for Judith's dual-tier (chat_ask / voice_ask) IAP model
---

# Judith RevenueCat Seed

## Rule
Run `pnpm --filter @workspace/scripts run seed:revenuecat` to idempotently recreate RC resources. The script is safe to re-run (all steps check for existing resources before creating).

**Why:** RC doesn't auto-create entitlements or packages — they must be seeded server-side.

## How to apply
- Call when onboarding a new RC project or after a teardown.
- Both `addIntegration` AND `proposeIntegration` are required before the connectors proxy will authenticate; without `proposeIntegration` the proxy returns "No connection found".
- `createClient` from `@replit/revenuecat-sdk/client` accepts a `fetch` option — pass a custom fetch that calls `connectors.proxy("revenuecat", path, opts)` to route through the Replit credential proxy.

## Resources created (proj2928d347)
- Test Store app: `app635acffcee`
- App Store app: `appd914edd639` (bundle: com.app.judith)
- Play Store app: `appca4c379d61` (package: com.app.judith)
- Products: chat_ask (₱99/mo), voice_ask (₱199/mo) — one per store
- Entitlements: `chat_ask`, `voice_ask`
- Offering: `default` (current) with packages `chat_ask`, `voice_ask`
- Play Store product IDs use `{id}:monthly` format (e.g. `chat_ask:monthly`)
