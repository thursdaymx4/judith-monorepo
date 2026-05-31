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

/** Lists the voices available on the configured ElevenLabs account. */
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
    voices?: { voice_id: string; name?: string; category?: string }[];
  };
  return (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name ?? v.voice_id,
    category: v.category ?? null,
  }));
}

/** Speech-to-text using ElevenLabs Scribe. */
export async function transcribe(
  audio: Buffer,
  mime: string,
): Promise<string> {
  const model = process.env["ELEVENLABS_STT_MODEL"] ?? "scribe_v1";
  const form = new FormData();
  form.append("model_id", model);
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: mime || "audio/m4a" }),
    "audio.m4a",
  );

  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey() },
    body: form,
  });

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
export async function synthesize(
  text: string,
  voiceId: string,
  opts?: { live?: boolean },
): Promise<{ base64: string; mime: string }> {
  const live = opts?.live ?? true;
  const preferred = live
    ? process.env["ELEVENLABS_TTS_LIVE_MODEL"] ?? "eleven_flash_v2_5"
    : process.env["ELEVENLABS_TTS_MODEL"] ?? "eleven_v3";

  const models = [...new Set([preferred, "eleven_multilingual_v2"])];
  let lastErr = "";

  for (const model_id of models) {
    const res = await fetch(
      `${BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ text, model_id }),
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
