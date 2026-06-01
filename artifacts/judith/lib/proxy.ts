import { supabase } from "./supabase";
import type { PersonaId } from "@/constants/personas";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/judith`;

async function authHeader(): Promise<Record<string, string>> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session?.access_token) {
    throw new Error("Not signed in");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Maps client persona ids to the api-server's persona ids. */
const PERSONA_MAP: Record<PersonaId, string> = {
  pro: "professional",
  funny: "funny",
  sib: "sarcastic",
  mama: "mom",
};

export interface AskBill {
  provider: string;
  cat: string;
  amount: number;
  dueDays: number;
  dueLabel: string;
  status: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

export interface AskResult {
  reply: string;
  audioBase64: string | null;
  mime: string;
}

export function transcribe(
  audioBase64: string,
  mimeType: string,
): Promise<{ text: string }> {
  return postJson("/stt", { audioBase64, mimeType });
}

export function askJudith(
  text: string,
  bills?: AskBill[],
  persona?: PersonaId,
): Promise<AskResult> {
  return postJson("/ask", {
    text,
    bills,
    persona: persona ? PERSONA_MAP[persona] : undefined,
  });
}

export function synthesize(
  text: string,
  persona?: PersonaId,
): Promise<{ audioBase64: string; mime: string }> {
  return postJson("/tts", {
    text,
    persona: persona ? PERSONA_MAP[persona] : undefined,
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
): Promise<{ text: string; audioBase64: string; mime: string }> {
  const headers = await authHeader();
  const res = await fetch(`${BASE}/sample?persona=${PERSONA_MAP[persona]}`, {
    headers,
  });
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
 * AI-powered bill-detail extraction from transcribed speech — no auth required.
 * Returns provider, amount (₱), dueDay (1-31 | null), and kind.
 */
export async function parseBillOnboarding(
  text: string,
  category: string,
): Promise<{
  provider: string;
  amount: number;
  dueDay: number | null;
  kind: "Fixed" | "Variable";
}> {
  const res = await fetch(`${BASE}/parse-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, category }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Parse bill failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as {
    provider: string;
    amount: number;
    dueDay: number | null;
    kind: "Fixed" | "Variable";
  };
}

/**
 * Speech-to-text during onboarding — no auth required.
 */
export async function transcribeOnboarding(
  audioBase64: string,
  mimeType: string,
): Promise<{ text: string }> {
  const res = await fetch(`${BASE}/stt-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`STT onboarding failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as { text: string };
}

/**
 * Synthesize arbitrary text during onboarding — no auth required.
 * Falls back silently on error; callers should catch().
 */
export async function synthOnboarding(
  text: string,
  persona?: PersonaId,
): Promise<{ audioBase64: string; mime: string }> {
  const res = await fetch(`${BASE}/tts-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      persona: persona ? PERSONA_MAP[persona] : "professional",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`TTS onboarding failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as { audioBase64: string; mime: string };
}

/**
 * Fetch the persona's pre-baked greeting sample during onboarding — no auth required.
 */
export async function fetchSampleOnboarding(
  persona: PersonaId,
): Promise<{ text: string; audioBase64: string; mime: string }> {
  const res = await fetch(
    `${BASE}/sample-onboarding?persona=${PERSONA_MAP[persona]}`,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sample onboarding failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as { text: string; audioBase64: string; mime: string };
}
