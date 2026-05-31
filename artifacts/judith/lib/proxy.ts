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

export function askJudith(text: string): Promise<AskResult> {
  return postJson("/ask", { text });
}

export function synthesize(
  text: string,
  persona?: PersonaId,
): Promise<{ audioBase64: string; mime: string }> {
  return postJson("/tts", { text, persona });
}

export async function fetchSample(
  persona: PersonaId,
): Promise<{ text: string; audioBase64: string; mime: string }> {
  const headers = await authHeader();
  const res = await fetch(`${BASE}/sample?persona=${persona}`, { headers });
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
