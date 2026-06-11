import { supabase } from "./supabase";
import type { PersonaId } from "@/constants/personas";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/judith`;

/** Maps client PersonaId → server persona string. */
const PERSONA_MAP: Record<PersonaId, string> = {
  pro: "professional",
  funny: "funny",
  sib: "sarcastic",
  mama: "mom",
  marites: "marites",
  britney: "britney",
};

/** Bill shape sent to the /ask endpoint as context. */
export interface AskBill {
  /** Stable bill id — used by bill-editing actions to target the right bill. */
  id?: string;
  provider: string;
  cat: string;
  amount: number;
  dueDays: number;
  dueLabel: string;
  status: string;
  /** "YYYY-MM" of the bill's next due date — lets the server build monthly summaries. */
  dueMonth?: string;
  /** True when this bill is a business/work expense. */
  isBusiness?: boolean;
  /** True when this charge is auto-billed to a credit card the user tracks. */
  chargedToCard?: boolean;
  /** Name of the credit card this charge is auto-billed to, if known. */
  cardName?: string | null;
  /**
   * True for next-month projected entries — they represent a future recurring
   * cycle that hasn't been billed yet. Server labels these as [ESTIMATED] in
   * the per-bill list and "(estimated)" in the monthly totals.
   */
  isProjection?: boolean;
  /** Amount already paid toward this bill in the current cycle. Omit when 0. */
  paidThisPeriod?: number;
  /** Original full amount before partial payment was subtracted. Required
   *  alongside paidThisPeriod so the server can render "X paid of Y total". */
  originalTotal?: number;
}

/**
 * Thrown when the user is not authenticated (no session token) or the server
 * returns 401 Unauthorized.  The ask screen catches this and shows a sign-in
 * prompt instead of the generic "something went wrong" message.
 */
export class AuthError extends Error {
  constructor() {
    super("auth_required");
    this.name = "AuthError";
  }
}

/** Returns Authorization header with the current Supabase session token.
 *  Throws AuthError if there is no active session. */
async function authHeader(): Promise<Record<string, string>> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session?.access_token) throw new UnauthorizedError();
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Like authHeader() but never throws — returns {} when there is no session so
 *  endpoints with a server-side guest fallback (e.g. /ask) work without sign-in.
 *  A 3-second timeout prevents a hung Supabase client from blocking the ask. */
async function optionalAuthHeader(): Promise<Record<string, string>> {
  try {
    const sessionP = supabase?.auth.getSession();
    if (!sessionP) return {};
    const result = await Promise.race([
      sessionP,
      new Promise<null>((r) => setTimeout(() => r(null), 3000)),
    ]);
    const session = result?.data?.session;
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` };
  } catch {}
  return {};
}

/**
 * Thrown when the server returns HTTP 429 (rate limited).
 * `retryAfter` is the number of seconds to wait before retrying,
 * taken from the `Retry-After` response header (defaults to 60).
 */
export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`rate_limit:${retryAfter}`);
    this.name = "RateLimitError";
  }
}

/** Throws RateLimitError if response status is 429. */
function throwIfRateLimited(res: Response) {
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? 60);
    throw new RateLimitError(Number.isFinite(retryAfter) ? retryAfter : 60);
  }
}

/**
 * Thrown when a request is aborted because it exceeded its timeout, so the UI
 * can show a "took too long — tap to retry" message instead of hanging forever.
 */
export class TimeoutError extends Error {
  constructor() {
    super("request_timed_out");
    this.name = "TimeoutError";
  }
}

/** Thrown when the server responds with a 5xx status code (not a network failure). */
export class ServerError extends Error {
  constructor(public readonly status: number, detail: string) {
    super(`server_error:${status}:${detail}`);
    this.name = "ServerError";
  }
}

/** Thrown when the server responds with 401 — the user has no valid session. */
export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Thrown when the caller cancelled the request (e.g. user closed the screen). */
export class AbortedError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortedError";
  }
}

async function postJsonOptAuth<T>(
  path: string,
  body: unknown,
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<T> {
  const headers = await optionalAuthHeader();
  // If the caller already aborted (e.g. user navigated away), bail immediately.
  if (signal?.aborted) throw new AbortedError();
  const controller = timeoutMs != null ? new AbortController() : null;
  const timer =
    controller != null ? setTimeout(() => controller.abort(), timeoutMs) : null;
  // Forward external abort into the internal timeout controller.
  const onExternalAbort = controller ? () => controller.abort() : undefined;
  if (signal && onExternalAbort) signal.addEventListener("abort", onExternalAbort, { once: true });
  const fetchSignal = controller?.signal ?? signal;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: fetchSignal,
    });
  } catch (e) {
    if (signal?.aborted) throw new AbortedError();
    if (controller?.signal.aborted || (e as Error)?.name === "AbortError") {
      throw new TimeoutError();
    }
    throw e;
  } finally {
    if (timer != null) clearTimeout(timer);
    if (signal && onExternalAbort) signal.removeEventListener("abort", onExternalAbort);
  }
  throwIfRateLimited(res);
  if (!res.ok) {
    if (res.status === 401) throw new UnauthorizedError();
    const detail = await res.text().catch(() => "");
    if (res.status >= 500) throw new ServerError(res.status, detail);
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
  const headers = await authHeader();
  const controller = timeoutMs != null ? new AbortController() : null;
  const timer =
    controller != null ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (e) {
    // An AbortError means our timeout fired; surface it as a typed TimeoutError.
    if (controller?.signal.aborted || (e as Error)?.name === "AbortError") {
      throw new TimeoutError();
    }
    throw e;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
  throwIfRateLimited(res);
  if (!res.ok) {
    if (res.status === 401) throw new UnauthorizedError();
    const detail = await res.text().catch(() => "");
    if (res.status >= 500) throw new ServerError(res.status, detail);
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

export interface AddBillAction {
  type: "add_bill";
  provider: string;
  cat: string;
  amount: number;
  dueDay: number;
}

export interface MarkPaidAction {
  type: "mark_paid";
  id: string;
}

export interface AddPaymentAction {
  type: "add_payment";
  id: string;
  amount: number;
}

export interface UpdateAmountAction {
  type: "update_amount";
  id: string;
  amount: number;
}

export interface UpdateBillAction {
  type: "update_bill";
  id: string;
  cat?: string;
  kind?: "Fixed" | "Variable";
  reminderDays?: number;
  isBusiness?: boolean;
  house?: string;
  chargedToCard?: boolean;
}

export type JudithAction =
  | AddBillAction
  | MarkPaidAction
  | AddPaymentAction
  | UpdateAmountAction
  | UpdateBillAction;

export interface AskResult {
  reply: string;
  audioBase64: string | null;
  mime: string;
  action?: JudithAction | null;
}

/** Returns today's date as YYYY-MM-DD in the device's local timezone. */
function localDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns the current day-of-week name from the device's local clock (e.g. "Sunday"). */
function localWeekdayString(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

export function transcribe(
  audioBase64: string,
  mimeType: string,
  language?: string,
): Promise<{ text: string }> {
  return postJson("/stt", { audioBase64, mimeType, language });
}

/**
 * Permanently deletes the signed-in user's server data (bills, profile) and
 * their auth account. Requires a valid session — throws otherwise.
 */
export async function deleteAccount(): Promise<{ ok: true }> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session?.access_token) {
    throw new Error("Sign in required to delete an account");
  }
  return postJson("/delete-account", {});
}

export function askJudith(
  text: string,
  bills?: AskBill[],
  persona?: PersonaId,
  language?: string,
  includeVoice?: boolean,
  currency?: string,
  countryName?: string,
  monthlyIncome?: number,
  countryCode?: string,
  incomeByMonth?: Record<string, number>,
  payCycle?: "monthly" | "semi-monthly" | "weekly",
  paydayDay?: number,
  paydaySemi?: [number, number],
  paydayWeekday?: number,
  history?: Array<{ role: "user" | "assistant"; text: string }>,
  signal?: AbortSignal,
): Promise<AskResult> {
  return postJsonOptAuth("/ask", {
    text,
    bills,
    persona: persona ? PERSONA_MAP[persona] : undefined,
    localDate: localDateString(),
    localWeekday: localWeekdayString(),
    language,
    includeVoice,
    currency,
    countryName,
    countryCode,
    monthlyIncome,
    incomeByMonth,
    payCycle,
    paydayDay,
    paydaySemi,
    paydayWeekday,
    history: history?.length ? history : undefined,
  }, 45_000, signal); // never let the chat hang forever — abort + surface a retry after 45s
}

/**
 * Streaming variant of askJudith. Calls the server with stream:true and delivers
 * text deltas via onDelta() as they arrive. Resolves with the final {reply, audioBase64,
 * mime, action} once the server sends the "done" event (after TTS completes server-side).
 * Falls back to a regular askJudith call if the environment does not support fetch streams
 * (e.g. older React Native without ReadableStream support).
 */
export async function askJudithStream(
  text: string,
  bills?: AskBill[],
  persona?: PersonaId,
  language?: string,
  includeVoice?: boolean,
  currency?: string,
  countryName?: string,
  monthlyIncome?: number,
  countryCode?: string,
  incomeByMonth?: Record<string, number>,
  payCycle?: "monthly" | "semi-monthly" | "weekly",
  paydayDay?: number,
  paydaySemi?: [number, number],
  paydayWeekday?: number,
  history?: Array<{ role: "user" | "assistant"; text: string }>,
  onDelta?: (delta: string) => void,
  onAudio?: (audioBase64: string) => void,
  signal?: AbortSignal,
): Promise<AskResult> {
  const body = {
    text,
    bills,
    persona: persona ? PERSONA_MAP[persona] : undefined,
    localDate: localDateString(),
    localWeekday: localWeekdayString(),
    language,
    includeVoice,
    currency,
    countryName,
    countryCode,
    monthlyIncome,
    incomeByMonth,
    payCycle,
    paydayDay,
    paydaySemi,
    paydayWeekday,
    history: history?.length ? history : undefined,
    stream: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  // Bridge the caller-supplied signal into our internal controller so unmounting
  // the screen kills the fetch immediately instead of waiting on the 45s timeout.
  const propagateAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", propagateAbort);
  const cleanup = () => {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", propagateAbort);
  };

  let resp: Response;
  try {
    resp = await fetch(`${BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    cleanup();
    if (signal?.aborted) throw new AbortedError();
    if (controller.signal.aborted || (err as Error)?.name === "AbortError") throw new TimeoutError();
    throw err;
  }

  throwIfRateLimited(resp);
  if (!resp.ok) {
    cleanup();
    if (resp.status === 401) throw new UnauthorizedError();
    const detail = await resp.text().catch(() => "");
    throw new ServerError(resp.status, detail);
  }

  if (!resp.body) {
    cleanup();
    // ReadableStream not available in this environment (older React Native) —
    // fall back to the plain JSON non-streaming path as promised in the JSDoc.
    return askJudith(
      text, bills, persona, language, includeVoice, currency, countryName,
      monthlyIncome, countryCode, incomeByMonth, payCycle, paydayDay,
      paydaySemi, paydayWeekday, history,
    );
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let doneResult: AskResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let evt: Record<string, unknown>;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === "delta" && typeof evt.text === "string") {
          onDelta?.(evt.text);
        } else if (evt.type === "audio" && typeof evt.audioBase64 === "string") {
          onAudio?.(evt.audioBase64);
        } else if (evt.type === "done") {
          doneResult = {
            reply: typeof evt.reply === "string" ? evt.reply : "",
            audioBase64: typeof evt.audioBase64 === "string" ? evt.audioBase64 : null,
            mime: typeof evt.mime === "string" ? evt.mime : "audio/mpeg",
            action: evt.action as AskResult["action"] ?? null,
          };
        } else if (evt.type === "error") {
          throw new ServerError(500, "stream_error");
        }
      }
    }
  } catch (err: unknown) {
    if (signal?.aborted) throw new AbortedError();
    throw err;
  } finally {
    cleanup();
    reader.releaseLock();
  }

  if (!doneResult) throw new ServerError(500, "no_done_event");
  return doneResult;
}

export function synthesize(
  text: string,
  persona?: PersonaId,
  language?: string,
  countryCode?: string,
): Promise<{ audioBase64: string; mime: string }> {
  return postJson("/tts", {
    text,
    persona: persona ? PERSONA_MAP[persona] : undefined,
    language,
    countryCode,
  });
}

export interface VoiceOption {
  id: string;
  name: string;
  category: string | null;
}

export async function fetchVoices(): Promise<VoiceOption[]> {
  const headers = await authHeader();
  const res = await fetch(`${BASE}/voices`, { headers });
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voices failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { voices: VoiceOption[] };
  return data.voices;
}

/** Synthesizes a short preview line with a specific voice. */
export function previewVoice(
  voiceId: string,
  text: string,
): Promise<{ audioBase64: string; mime: string }> {
  return postJson("/tts", { text, voiceId });
}

export type SampleResult = { text: string; url: string | null; audioBase64: string | null; mime: string };

/** In-memory cache for authenticated settings persona samples. */
const _settingsSampleCache = new Map<string, SampleResult>();
const _settingsSampleInflight = new Map<string, Promise<SampleResult>>();

export async function fetchSample(
  persona: PersonaId,
  language?: string,
  countryCode?: string,
): Promise<SampleResult> {
  const effectiveCountryCode =
    countryCode && countryCode.toUpperCase() === "PH" ? countryCode.toUpperCase() : undefined;
  const cacheKey = `${persona}__${language ?? "en"}__${effectiveCountryCode ?? ""}`;
  const hit = _settingsSampleCache.get(cacheKey);
  if (hit) return hit;
  const inflight = _settingsSampleInflight.get(cacheKey);
  if (inflight) return inflight;

  const fetchWithLanguage = async (langCode?: string, cc?: string): Promise<SampleResult> => {
    const headers = await authHeader();
    const lang = langCode ? `&language=${encodeURIComponent(langCode)}` : "";
    const ccQuery = cc ? `&countryCode=${encodeURIComponent(cc)}` : "";
    const res = await fetch(`${BASE}/sample?persona=${PERSONA_MAP[persona]}${lang}${ccQuery}`, {
      headers,
    });
    throwIfRateLimited(res);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Sample failed (${res.status}): ${detail}`);
    }
    const raw = (await res.json()) as { text: string; url?: string; audioBase64?: string; mime?: string };
    if (!raw.url && !raw.audioBase64) throw new Error("Sample failed: empty audio payload");
    return {
      text: raw.text,
      url: raw.url ?? null,
      audioBase64: raw.audioBase64 ?? null,
      mime: raw.mime ?? "audio/mpeg",
    };
  };

  const request = (async () => {
    try {
      const result = await fetchWithLanguage(language, effectiveCountryCode);
      _settingsSampleCache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (language === "en-US") throw error;
      const fallback = await fetchWithLanguage("en-US");
      _settingsSampleCache.set(cacheKey, fallback);
      return fallback;
    }
  })();

  _settingsSampleInflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    _settingsSampleInflight.delete(cacheKey);
  }
}

/**
 * AI ask during onboarding — no auth required.
 * Accepts the user's bills from the onboarding store as context.
 */
export async function askOnboarding(
  text: string,
  bills?: Array<{
    provider?: string | null;
    cat?: string | null;
    amount?: number | null;
    dueDays?: number | null;
    dueLabel?: string | null;
    dueMonth?: string | null;
    status?: string | null;
    isProjection?: boolean | null;
  }>,
  persona?: PersonaId,
  language?: string,
  currency?: string,
): Promise<AskResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(`${BASE}/ask-onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        bills,
        persona: persona ? PERSONA_MAP[persona] : "professional",
        localDate: localDateString(),
        language,
        currency,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted || (e as Error)?.name === "AbortError") {
      throw new TimeoutError();
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Ask onboarding failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<AskResult>;
}

/**
 * Vision AI extraction of active subscriptions from a phone subscriptions screenshot.
 * No auth required — called during onboarding.
 */
export async function parseSubscriptionScreenshot(
  imageBase64: string,
  mimeType: string,
): Promise<{ subscriptions: { provider: string; amount: number | null; dueDay: number | null; frequency: "monthly" | "annual"; nextDue: string | null }[] }> {
  const res = await fetch(`${BASE}/parse-subscription-screenshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Parse screenshot failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<{
    subscriptions: { provider: string; amount: number | null; dueDay: number | null; frequency: "monthly" | "annual"; nextDue: string | null }[];
  }>;
}

/**
 * AI-powered bill-detail extraction from transcribed speech — no auth required.
 * Returns provider, amount (₱), dueDay (1-31 | null), and kind.
 */
export async function parseBillOnboarding(
  text: string,
  category: string,
): Promise<{
  provider: string | null;
  amount: number | null;
  dueDay: number | null;
  kind: "Fixed" | "Variable";
  frequency: "monthly" | "annual";
  skip: boolean;
}> {
  const res = await fetch(`${BASE}/parse-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, category }),
  });
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Parse bill failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as {
    provider: string | null;
    amount: number | null;
    dueDay: number | null;
    kind: "Fixed" | "Variable";
    frequency: "monthly" | "annual";
    skip: boolean;
  };
}

/**
 * Speech-to-text during onboarding — no auth required.
 */
export async function transcribeOnboarding(
  audioBase64: string,
  mimeType: string,
  language?: string,
): Promise<{ text: string }> {
  const res = await fetch(`${BASE}/stt-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, mimeType, language }),
  });
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`STT onboarding failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as { text: string };
}

/**
 * In-memory TTS cache for onboarding.
 * Keys are `${text}__${persona}`. Lives for the app session — no persistence needed.
 * Eliminates the ElevenLabs round-trip for any screen the user revisits.
 */
const _synthCache = new Map<string, { audioBase64: string; mime: string }>();

/**
 * Synthesize arbitrary text during onboarding — no auth required.
 * Results are cached so revisiting a screen plays instantly.
 */
export async function synthOnboarding(
  text: string,
  persona?: PersonaId,
  language?: string,
): Promise<{ audioBase64: string; mime: string }> {
  const cacheKey = `${text}__${persona ?? "pro"}__${language ?? "en"}`;
  const hit = _synthCache.get(cacheKey);
  if (hit) return hit;

  const res = await fetch(`${BASE}/tts-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      persona: persona ? PERSONA_MAP[persona] : "professional",
      language,
    }),
  });
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`TTS onboarding failed (${res.status}): ${detail}`);
  }
  const result = (await res.json()) as { audioBase64: string; mime: string };
  _synthCache.set(cacheKey, result);
  return result;
}

/** In-memory sample cache keyed by `${persona}__${language}`. */
const _sampleCache = new Map<string, { text: string; audioBase64: string; mime: string }>();

/**
 * Fetch the persona's pre-baked greeting sample during onboarding — no auth required.
 * Results are cached so repeated taps and prefetch warm-ups are instant.
 * Pass `language` so Filipino/Taglish users hear the right native-speaker voice.
 */
export async function fetchSampleOnboarding(
  persona: PersonaId,
  language?: string,
): Promise<{ text: string; audioBase64: string; mime: string }> {
  const cacheKey = `${persona}__${language ?? "en"}`;
  const hit = _sampleCache.get(cacheKey);
  if (hit) return hit;

  const lang = language ? `&language=${encodeURIComponent(language)}` : "";
  const res = await fetch(
    `${BASE}/sample-onboarding?persona=${PERSONA_MAP[persona]}${lang}`,
  );
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sample onboarding failed (${res.status}): ${detail}`);
  }
  const result = (await res.json()) as { text: string; audioBase64: string; mime: string };
  _sampleCache.set(cacheKey, result);
  return result;
}
