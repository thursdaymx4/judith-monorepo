import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit";
import { bearerToken, getUserFromToken } from "../lib/supabaseAdmin";
import type { Request } from "express";

/**
 * Short-lived in-memory cache for verified JWT → user ID mappings.
 * Avoids a Supabase round-trip on every request while keeping the window
 * small enough that a revoked token cannot be abused for long.
 */
const _tokenCache = new Map<string, { userId: string; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function resolveUserId(token: string): Promise<string | null> {
  const now = Date.now();
  const cached = _tokenCache.get(token);
  if (cached && cached.expiresAt > now) return cached.userId;
  const user = await getUserFromToken(token).catch(() => null);
  if (!user) {
    _tokenCache.delete(token);
    return null;
  }
  _tokenCache.set(token, { userId: user.id, expiresAt: now + TOKEN_CACHE_TTL_MS });
  // Prevent unbounded growth — evict expired entries occasionally
  if (_tokenCache.size > 1000) {
    for (const [k, v] of _tokenCache) {
      if (v.expiresAt <= now) _tokenCache.delete(k);
    }
  }
  return user.id;
}

/**
 * Key for authenticated endpoints.
 * Verifies the Bearer token via Supabase (with a 5-minute in-memory cache)
 * and keys by `uid:<id>`. Falls back to `ip:<req.ip>` if the token is absent
 * or invalid — a forged token can never impersonate a real user's bucket.
 */
async function keyByVerifiedUser(req: Request): Promise<string> {
  const token = bearerToken(req.headers.authorization);
  if (token) {
    const userId = await resolveUserId(token);
    if (userId) return `uid:${userId}`;
  }
  return `ip:${await ipKeyGenerator(req)}`;
}

/**
 * Key for unauthenticated / guest endpoints.
 * Always uses `req.ip` derived from the trust-proxy configuration in app.ts —
 * clients cannot spoof it via x-forwarded-for.
 */
async function keyByIp(req: Request): Promise<string> {
  return `ip:${await ipKeyGenerator(req)}`;
}

const HANDLER: Options["handler"] = (_req, res) => {
  const retryAfter = Math.ceil(Number(res.getHeader("Retry-After") ?? 60));
  res.status(429).json({ error: "rate_limit", retryAfter });
};

/** Authenticated endpoints — keyed by verified Supabase user ID (falls back to IP). */
export function userLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: keyByVerifiedUser,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: HANDLER,
  });
}

/** Guest / onboarding endpoints — keyed strictly by trusted IP. */
export function ipLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: keyByIp,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: HANDLER,
  });
}

const HOUR = 60 * 60 * 1000;

export const askLimiter              = userLimiter(HOUR, 40);
export const sttTtsLimiter           = userLimiter(HOUR, 60);
export const sampleVoicesLimiter     = userLimiter(HOUR, 30);
export const parseLimiter            = userLimiter(HOUR, 20);
export const askOnboardingLimiter    = ipLimiter(HOUR, 40);
// Raised from 20 → 80: onboarding has many screens (up to ~15 voice lines per
// run) and developers re-test repeatedly; 20/hr was too easy to exhaust.
export const sttTtsOnboardingLimiter = ipLimiter(HOUR, 80);
export const sampleOnboardingLimiter = ipLimiter(HOUR, 60);
