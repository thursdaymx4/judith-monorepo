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
 * `languageCode` is an optional ISO-639 hint that improves accuracy for the
 * user's chosen language/dialect. If the hint is unsupported, we transparently
 * retry with auto-detection so transcription never fails because of it.
 */
export async function transcribe(
  audio: Buffer,
  mime: string,
  languageCode?: string,
): Promise<string> {
  const model = process.env["ELEVENLABS_STT_MODEL"] ?? "scribe_v1";

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

  let res = await attempt(languageCode);
  // Unsupported language hint → retry with auto-detect rather than failing.
  if (!res.ok && languageCode) {
    res = await attempt(undefined);
  }

  if (!res.ok) {
    throw new Error(`ElevenLabs STT failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
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
    // Live replies: more variable cadence → sounds like someone actually talking
    ? { stability: 0.32, similarity_boost: 0.80, style: 0.28, use_speaker_boost: true }
    // Non-live (onboarding, samples): more expressive character, higher fidelity
    : { stability: 0.28, similarity_boost: 0.88, style: 0.42, use_speaker_boost: true };
}

export async function synthesize(
  text: string,
  voiceId: string,
  opts?: { live?: boolean },
): Promise<{ base64: string; mime: string }> {
  const live = opts?.live ?? true;
  const preferred = live
    ? process.env["ELEVENLABS_TTS_LIVE_MODEL"] ?? "eleven_flash_v2_5"
    : process.env["ELEVENLABS_TTS_MODEL"] ?? "eleven_v3";

  /* Higher bitrate for non-live (onboarding, samples) — audibly better quality */
  const outputFormat = live ? "mp3_44100_128" : "mp3_44100_192";
  const models = [...new Set([preferred, "eleven_multilingual_v2"])];
  let lastErr = "";

  for (const model_id of models) {
    const res = await fetch(
      `${BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ text, model_id, voice_settings: voiceSettings(live) }),
      },
    );
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      return { base64: buf.toString("base64"), mime: "audio/mpeg" };
    }
    lastErr = `${res.status}: ${await res.text()}`;
  }
  throw new Error(`ElevenLabs TTS failed (${lastErr})`);
}
