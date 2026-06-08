import { Storage } from "@google-cloud/storage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

let _bucket: ReturnType<Storage["bucket"]> | null = null;

function getBucket() {
  if (!BUCKET_ID) return null;
  try {
    if (!_bucket) {
      const storage = new Storage({
        credentials: {
          audience: "replit",
          subject_token_type: "access_token",
          token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
          type: "external_account",
          credential_source: {
            url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
            format: {
              type: "json",
              subject_token_field_name: "access_token",
            },
          },
          universe_domain: "googleapis.com",
        },
        projectId: "",
      });
      _bucket = storage.bucket(BUCKET_ID);
    }
    return _bucket;
  } catch {
    return null;
  }
}

/**
 * Collapse a language code to its cache group key.
 * All English variants share "en"; all Filipino dialects share "fil".
 */
export function cacheLanguageGroup(lang: string): string {
  if (lang.startsWith("en")) return "en";
  if (lang === "fil" || lang === "ceb" || lang === "ilo" || lang === "hil") return "fil";
  return lang;
}

const PREFIX = "onb-voice";
const SAMPLE_PREFIX = "persona-sample";

/** Return cached onboarding audio, or null on miss / storage unavailable. */
export async function getOnbAudio(
  concept: string,
  persona: string,
  lang: string,
): Promise<{ base64: string; mime: string } | null> {
  const bucket = getBucket();
  if (!bucket) return null;
  try {
    const key = `${PREFIX}/${concept}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const file = bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return { base64: buf.toString("base64"), mime: "audio/mpeg" };
  } catch {
    return null;
  }
}

/** Write onboarding audio to the cache. Non-critical — never throws. */
export async function setOnbAudio(
  concept: string,
  persona: string,
  lang: string,
  audioBase64: string,
): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    const key = `${PREFIX}/${concept}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const buf = Buffer.from(audioBase64, "base64");
    await bucket.file(key).save(buf, {
      resumable: false,
      metadata: { contentType: "audio/mpeg" },
    });
  } catch {
    // Non-critical — live ElevenLabs generation still serves the response.
  }
}

/** Return cached persona-sample audio, or null on miss / storage unavailable. */
export async function getSampleAudio(
  persona: string,
  lang: string,
): Promise<{ base64: string; mime: string } | null> {
  const bucket = getBucket();
  if (!bucket) return null;
  try {
    const key = `${SAMPLE_PREFIX}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const file = bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return { base64: buf.toString("base64"), mime: "audio/mpeg" };
  } catch {
    return null;
  }
}

/** Write persona-sample audio to the cache. Non-critical — never throws. */
export async function setSampleAudio(
  persona: string,
  lang: string,
  audioBase64: string,
): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    const key = `${SAMPLE_PREFIX}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const buf = Buffer.from(audioBase64, "base64");
    await bucket.file(key).save(buf, {
      resumable: false,
      metadata: { contentType: "audio/mpeg" },
    });
  } catch {
    // Non-critical — live ElevenLabs generation still serves the response.
  }
}

/** Check existence only (used by the pregen script). */
export async function hasSampleAudio(
  persona: string,
  lang: string,
): Promise<boolean> {
  const bucket = getBucket();
  if (!bucket) return false;
  try {
    const key = `${SAMPLE_PREFIX}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const [exists] = await bucket.file(key).exists();
    return exists;
  } catch {
    return false;
  }
}

/** Check existence only (used by the pregen script to skip already-done combos). */
export async function hasOnbAudio(
  concept: string,
  persona: string,
  lang: string,
): Promise<boolean> {
  const bucket = getBucket();
  if (!bucket) return false;
  try {
    const key = `${PREFIX}/${concept}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const [exists] = await bucket.file(key).exists();
    return exists;
  } catch {
    return false;
  }
}
