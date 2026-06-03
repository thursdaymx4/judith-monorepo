---
name: Judith rate limiting
description: express-rate-limit v8 setup — ipKeyGenerator requirement and per-route limits
---

Always import and use `ipKeyGenerator` from `express-rate-limit` in any custom `keyGenerator` function that falls back to client IP. Using `req.ip` directly throws `ERR_ERL_KEY_GEN_IPV6` on startup (a hard `ValidationError` in v8+).

**Why:** express-rate-limit v8 validates that all IP-based key generators properly handle IPv6-mapped IPv4 addresses (e.g. `::ffff:1.2.3.4`). Plain `req.ip` fails this check even though it works at runtime — the library throws before the server starts.

**How to apply:**
```ts
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// User-keyed (falls back to IP)
keyGenerator(req) {
  const sub = jwtSub(bearerFromReq(req));
  return sub ?? ipKeyGenerator(req);  // NOT req.ip ?? "unknown"
}

// Pure IP limiter
keyGenerator: ipKeyGenerator,  // pass directly, don't wrap
```

Per-route limits (task spec):
- `/ask`                        → 40 req/hr by user ID
- `/stt`, `/tts`                → 60 req/hr by user ID
- `/sample`, `/voices`          → 30 req/hr by user ID
- `/parse-bill`, `/parse-subscription-screenshot` → 20 req/hr by user ID
- `/ask-onboarding`             → 10 req/hr by IP
- `/stt-onboarding`, `/tts-onboarding` → 20 req/hr by IP

The `Retry-After` header is set to `windowMs / 1000` seconds. Client (`proxy.ts`) reads it from the 429 response and throws `RateLimitError(retryAfter)`.
