import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request } from "express";

/**
 * Decodes a JWT without verifying the signature, purely to extract the
 * `sub` field as a rate-limit key. Auth verification still happens in
 * requireUser — this is only for bucketing requests.
 */
function jwtSub(token: string | undefined): string | undefined {
  if (!token) return undefined;
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { sub?: string };
    return parsed.sub ?? undefined;
  } catch {
    return undefined;
  }
}

function bearerFromReq(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return undefined;
  return auth.slice(7).trim() || undefined;
}

/**
 * Creates an express-rate-limit middleware keyed by Supabase user ID
 * (extracted from the JWT without verification). Falls back to normalized IP
 * for unauthenticated / guest requests.
 *
 * Rate-limit table (from task spec):
 *   ask              → 40 req / hr  user
 *   stt, tts         → 60 req / hr  user
 *   sample, voices   → 30 req / hr  user
 *   parse-*          → 20 req / hr  user
 *   ask-onboarding   → 10 req / hr  IP
 *   stt/tts-onboarding → 20 req / hr IP
 */
export function makeUserRateLimiter(
  max: number,
  windowMs: number = 60 * 60 * 1000,
  overrides: Partial<Options> = {},
) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator(req) {
      const sub = jwtSub(bearerFromReq(req));
      // Use user ID when available; fall back to normalized IP (ipKeyGenerator
      // handles IPv6 mapping so IPv4-in-IPv6 doesn't escape limits).
      return sub ?? ipKeyGenerator(req);
    },
    handler(_req, res) {
      const retryAfter = Math.ceil(windowMs / 1000);
      res
        .status(429)
        .setHeader("Retry-After", String(retryAfter))
        .json({ error: "rate_limit", retryAfter });
    },
    skip: () => false,
    ...overrides,
  });
}

/** IP-keyed limiter — used for unauthenticated onboarding routes. */
export function makeIpRateLimiter(
  max: number,
  windowMs: number = 60 * 60 * 1000,
) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    handler(_req, res) {
      const retryAfter = Math.ceil(windowMs / 1000);
      res
        .status(429)
        .setHeader("Retry-After", String(retryAfter))
        .json({ error: "rate_limit", retryAfter });
    },
  });
}

// Pre-built limiters matching the task spec
export const limitAsk              = makeUserRateLimiter(40);
export const limitSttTts           = makeUserRateLimiter(60);
export const limitSampleVoices     = makeUserRateLimiter(30);
export const limitParse            = makeUserRateLimiter(20);
export const limitAskOnboarding    = makeIpRateLimiter(10);
export const limitSttTtsOnboarding = makeIpRateLimiter(20);
