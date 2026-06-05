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
};

/** Bill shape sent to the /ask endpoint as context. */
export interface AskBill {
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
}

/** Returns Authorization header with the current Supabase session token. */
async function authHeader(): Promise<Record<string, string>> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
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


async function postJson<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
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

export interface AskResult {
  reply: string;
  audioBase64: string | null;
  mime: string;
  action?: AddBillAction | null;
}

/** Returns today's date as YYYY-MM-DD in the device's local timezone. */
function localDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
): Promise<AskResult> {
  return postJson("/ask", {
    text,
    bills,
    persona: persona ? PERSONA_MAP[persona] : undefined,
    localDate: localDateString(),
    language,
    includeVoice,
    currency,
    countryName,
    countryCode,
    monthlyIncome,
  });
}

export function synthesize(
  text: string,
  persona?: PersonaId,
  language?: string,
): Promise<{ audioBase64: string; mime: string }> {
  return postJson("/tts", {
    text,
    persona: persona ? PERSONA_MAP[persona] : undefined,
    language,
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

export async function fetchSample(
  persona: PersonaId,
  language?: string,
): Promise<{ text: string; audioBase64: string; mime: string }> {
  const headers = await authHeader();
  const lang = language ? `&language=${encodeURIComponent(language)}` : "";
  const res = await fetch(`${BASE}/sample?persona=${PERSONA_MAP[persona]}${lang}`, {
    headers,
  });
  throwIfRateLimited(res);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sample failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as {
    text: string;
    audioBase64: string;
    mime: string;
  };
}

/**
 * AI ask during onboarding — no auth required.
 * Accepts the user's bills from the onboarding store as context.
 */
export function askOnboarding(
  text: string,
  bills?: Array<{
    provider?: string | null;
    cat?: string | null;
    amount?: number | null;
    dueDays?: number | null;
    dueLabel?: string | null;
    status?: string | null;
  }>,
  persona?: PersonaId,
  language?: string,
): Promise<AskResult> {
  return fetch(`${BASE}/ask-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      bills,
      persona: persona ? PERSONA_MAP[persona] : "professional",
      localDate: localDateString(),
      language,
    }),
  }).then(async (res) => {
    throwIfRateLimited(res);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Ask onboarding failed (${res.status}): ${detail}`);
    }
    return res.json() as Promise<AskResult>;
  });
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
