const BASE = "https://api.elevenlabs.io/v1";

function apiKey(): string {
  const k = process.env["ELEVENLABS_API_KEY"];
  if (!k) throw new Error("ELEVENLABS_API_KEY is not set.");
  return k;
}

export interface VoiceOption {
  id: string;
  name: string;
  category: string | null;
}

/**
 * Lists the female voices available on the configured ElevenLabs account.
 * Judith is a female assistant, so non-female voices are filtered out.
 */
export async function listVoices(): Promise<VoiceOption[]> {
  const res = await fetch(`${BASE}/voices`, {
    headers: { "xi-api-key": apiKey() },
  });
  if (!res.ok) {
    throw new Error(
      `ElevenLabs voices failed (${res.status}): ${await res.text()}`,
    );
  }
  const data = (await res.json()) as {
    voices?: {
      voice_id: string;
      name?: string;
      category?: string;
      labels?: { gender?: string };
    }[];
  };
  return (data.voices ?? [])
    .filter((v) => (v.labels?.gender ?? "").toLowerCase() === "female")
    .map((v) => ({
      id: v.voice_id,
      name: v.name ?? v.voice_id,
      category: v.category ?? null,
    }));
}

/**
 * Speech-to-text using ElevenLabs Scribe.
 *
 * Default model is scribe_v2 (override via ELEVENLABS_STT_MODEL env var).
 * `languageCode` is an optional ISO-639 hint that improves accuracy for the
 * user's chosen language/dialect. If the hint is unsupported, we transparently
 * retry with auto-detection so transcription never fails because of it.
 *
 * COST VISIBILITY: each call logs [STT] model / audio-kb / transcript-chars
 * to the server console so you can track usage across test sessions.
 */
export async function transcribe(
  audio: Buffer,
  mime: string,
  languageCode?: string,
): Promise<string> {
  const model = process.env["ELEVENLABS_STT_MODEL"] ?? "scribe_v2";

  const attempt = async (lang?: string) => {
    const form = new FormData();
    form.append("model_id", model);
    if (lang) form.append("language_code", lang);
    form.append(
      "file",
      new Blob([new Uint8Array(audio)], { type: mime || "audio/m4a" }),
      "audio.m4a",
    );
    return fetch(`${BASE}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": apiKey() },
      body: form,
    });
  };

  const t0 = Date.now();
  let res = await attempt(languageCode);
  // Unsupported language hint → retry with auto-detect rather than failing.
  if (!res.ok && languageCode) {
    res = await attempt(undefined);
  }

  if (!res.ok) {
    throw new Error(`ElevenLabs STT failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  const ms = Date.now() - t0;
  const kb = (audio.byteLength / 1024).toFixed(1);
  console.log(`[STT] model=${model} lang=${languageCode ?? "auto"} audio=${kb}kb → ${text.length}chars in ${ms}ms`);
  return text;
}

/**
 * Text-to-speech. Uses a low-latency model for live replies and an expressive
 * model for pre-generated lines, falling back to multilingual_v2 if the
 * preferred model is unavailable on the account/plan.
 */
/**
 * Voice settings tuned per use-case:
 *  - live: lower stability → more expressive/natural cadence for quick replies
 *  - non-live (onboarding/sample): higher similarity + style for polished first impression
 */
function voiceSettings(live: boolean) {
  return live
    ? { stability: 0.45, similarity_boost: 0.82, style: 0.22, use_speaker_boost: true }
    : { stability: 0.35, similarity_boost: 0.88, style: 0.38, use_speaker_boost: true };
}

/* ---------- number → natural speech helpers ---------- */

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
              "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
              "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function intToWords(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) return "negative " + intToWords(-n);
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? "-" + ONES[n % 10]! : "");
  if (n < 1000) {
    const rem = n % 100;
    return ONES[Math.floor(n / 100)]! + " hundred" + (rem ? " " + intToWords(rem) : "");
  }
  if (n < 1_000_000) {
    const t = Math.floor(n / 1000);
    const rem = n % 1000;
    return intToWords(t) + " thousand" + (rem ? " " + intToWords(rem) : "");
  }
  if (n < 1_000_000_000) {
    const m = Math.floor(n / 1_000_000);
    const rem = n % 1_000_000;
    return intToWords(m) + " million" + (rem ? " " + intToWords(rem) : "");
  }
  const b = Math.floor(n / 1_000_000_000);
  const rem = n % 1_000_000_000;
  return intToWords(b) + " billion" + (rem ? " " + intToWords(rem) : "");
}

/**
 * Converts numbers and peso amounts in text to their spoken equivalents so
 * ElevenLabs reads them naturally instead of digit-by-digit.
 *
 * Examples:
 *   "₱274,748"  →  "two hundred seventy-four thousand seven hundred forty-eight pesos"
 *   "₱25,000"   →  "twenty-five thousand pesos"
 *   "3 bills"   →  "3 bills"  (short counts left for ElevenLabs — it handles them fine)
 */
function prepareForTTS(text: string): string {
  // Replace ₱ amounts (with optional comma-grouping) → "X pesos"
  return text.replace(/₱\s?([\d,]+)/g, (_match, digits: string) => {
    const n = parseInt(digits.replace(/,/g, ""), 10);
    if (isNaN(n)) return _match;
    return intToWords(n) + " pesos";
  });
}

export async function synthesize(
  text: string,
  voiceId: string,
  opts?: { live?: boolean; speed?: number },
): Promise<{ base64: string; mime: string }> {
  const live = opts?.live ?? true;
  const preferred = live
    ? process.env["ELEVENLABS_TTS_LIVE_MODEL"] ?? "eleven_flash_v2_5"
    : process.env["ELEVENLABS_TTS_MODEL"] ?? "eleven_v3";

  const outputFormat = live ? "mp3_44100_128" : "mp3_44100_192";
  const models = [...new Set([preferred, "eleven_multilingual_v2"])];
  // Slightly slower than default (1.0) — more conversational, easier to follow.
  // Callers can override per-persona (e.g. Marites speaks faster).
  const speed = opts?.speed ?? 0.92;
  const ttsText = prepareForTTS(text);
  let lastErr = "";

  for (const model_id of models) {
    const t0 = Date.now();
    const res = await fetch(
      `${BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ text: ttsText, model_id, voice_settings: voiceSettings(live), speed }),
      },
    );
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const ms = Date.now() - t0;
      const kb = (buf.byteLength / 1024).toFixed(1);
      console.log(`[TTS] model=${model_id} live=${live} chars=${ttsText.length} → ${kb}kb audio in ${ms}ms`);
      return { base64: buf.toString("base64"), mime: "audio/mpeg" };
    }
    lastErr = `${res.status}: ${await res.text()}`;
  }
  throw new Error(`ElevenLabs TTS failed (${lastErr})`);
}
