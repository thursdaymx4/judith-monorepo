import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    

// src/lib/elevenlabs.ts
var BASE = "https://api.elevenlabs.io/v1";
function apiKey() {
  const k = process.env["ELEVENLABS_API_KEY"];
  if (!k) throw new Error("ELEVENLABS_API_KEY is not set.");
  return k;
}
function voiceSettings(live) {
  return live ? { stability: 0.45, similarity_boost: 0.82, style: 0.22, use_speaker_boost: true } : { stability: 0.35, similarity_boost: 0.88, style: 0.38, use_speaker_boost: true };
}
var ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen"
];
var TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function intToWords(n) {
  if (n === 0) return "zero";
  if (n < 0) return "negative " + intToWords(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1e3) {
    const rem2 = n % 100;
    return ONES[Math.floor(n / 100)] + " hundred" + (rem2 ? " " + intToWords(rem2) : "");
  }
  if (n < 1e6) {
    const t = Math.floor(n / 1e3);
    const rem2 = n % 1e3;
    return intToWords(t) + " thousand" + (rem2 ? " " + intToWords(rem2) : "");
  }
  if (n < 1e9) {
    const m = Math.floor(n / 1e6);
    const rem2 = n % 1e6;
    return intToWords(m) + " million" + (rem2 ? " " + intToWords(rem2) : "");
  }
  const b = Math.floor(n / 1e9);
  const rem = n % 1e9;
  return intToWords(b) + " billion" + (rem ? " " + intToWords(rem) : "");
}
var FILIPINO_TTS_LANGS = /* @__PURE__ */ new Set(["fil", "ceb", "ilo", "hil"]);
var CURRENCY_SPOKEN = [
  ["CA$", "Canadian dollars"],
  ["A$", "Australian dollars"],
  ["NZ$", "New Zealand dollars"],
  ["HK$", "Hong Kong dollars"],
  ["S$", "Singapore dollars"],
  ["US$", "dollars"],
  ["\xA3", "pounds"],
  ["\u20AC", "euros"],
  ["\xA5", "yen"],
  ["\u20A9", "won"],
  ["\u20B9", "rupees"],
  ["\uFDFC", "riyals"],
  ["\u0E3F", "baht"],
  ["\u20AB", "dong"]
];
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function prepareForTTS(text, language) {
  const lang = (language ?? "fil").toLowerCase();
  const isFilipino = FILIPINO_TTS_LANGS.has(lang) || lang === "fil" || !language || lang.startsWith("en");
  let result = text;
  for (const [sym, spoken] of CURRENCY_SPOKEN) {
    const esc = escapeRegex(sym);
    result = result.replace(
      new RegExp(`(-|negative\\s+)?${esc}\\s?(-?)\\s?([\\d,]+)`, "gi"),
      (_m, negPrefix, negSuffix, digits) => {
        const isNeg = !!(negPrefix?.trim() || negSuffix);
        return isNeg ? `negative ${digits} ${spoken}` : `${digits} ${spoken}`;
      }
    );
  }
  if (isFilipino) {
    result = result.replace(/-\s*₱\s*([\d,]+)/g, (_m, digits) => {
      const n = parseInt(digits.replace(/,/g, ""), 10);
      return isNaN(n) ? _m : "negative " + intToWords(n) + " pesos";
    });
    result = result.replace(/₱\s?(-?)\s*([\d,]+)/g, (_m, sign, digits) => {
      const n = parseInt(digits.replace(/,/g, ""), 10);
      if (isNaN(n)) return _m;
      const words = intToWords(n) + " pesos";
      return sign === "-" ? "negative " + words : words;
    });
  } else {
    result = result.replace(
      /-\s*₱\s*([\d,]+)/g,
      (_m, digits) => `negative ${digits} pesos`
    );
    result = result.replace(
      /₱\s?(-?)\s*([\d,]+)/g,
      (_m, sign, digits) => sign === "-" ? `negative ${digits} pesos` : `${digits} pesos`
    );
  }
  return result;
}
async function synthesize(text, voiceId, opts) {
  const live = opts?.live ?? true;
  const preferred = live ? process.env["ELEVENLABS_TTS_LIVE_MODEL"] ?? "eleven_flash_v2_5" : process.env["ELEVENLABS_TTS_MODEL"] ?? "eleven_v3";
  const outputFormat = live ? "mp3_44100_128" : "mp3_44100_192";
  const models = [.../* @__PURE__ */ new Set([preferred, "eleven_multilingual_v2"])];
  const speed = opts?.speed ?? 0.92;
  const ttsText = prepareForTTS(text, opts?.language);
  let lastErr = "";
  for (const model_id of models) {
    const t0 = Date.now();
    const res = await fetch(
      `${BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey(),
          "content-type": "application/json"
        },
        body: JSON.stringify({ text: ttsText, model_id, voice_settings: voiceSettings(live), speed })
      }
    );
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const ms = Date.now() - t0;
      const kb = (buf.byteLength / 1024).toFixed(1);
      console.log(`[TTS] model=${model_id} live=${live} chars=${ttsText.length} \u2192 ${kb}kb audio in ${ms}ms`);
      return { base64: buf.toString("base64"), mime: "audio/mpeg" };
    }
    lastErr = `${res.status}: ${await res.text()}`;
  }
  throw new Error(`ElevenLabs TTS failed (${lastErr})`);
}

// src/lib/personas.ts
var DEFAULT_VOICE_IDS = {
  professional: "EXAVITQu4vr4xnSDxMaL",
  // Sarah — mature, reassuring, confident (american)
  funny: "NHRgOEwqx5WZNClv5sat",
  // Chelsea — friendly, approachable, bright (american)
  sarcastic: "56AoDkrOh6qfVPDXZ7Pt",
  // Cassidy — crisp, direct, conversational (american)
  mom: "hpp4J3VqNfWAUOO0d1Us",
  // Bella — professional, bright, warm, middle-aged (american)
  marites: "cgSgspJ2msm6clMCkdW9",
  // Jessica — playful, bright, warm, young (american)
  britney: "Xb7hH8MSUJpSbSDYk0k2"
  // Alice — sharp, crisp, British (british)
};
var FILIPINO_VOICE_IDS = {
  professional: "n6WaB3rOlZSC9y8yEPEz",
  funny: "cvnP6nKXpiWGFASDWN3Y",
  mom: "gILcvhAz18uV9ARSsU4u",
  sarcastic: "RGymW84CSmfVugnA5tvA",
  marites: "XB0fDUnXU5powFXDhCwa",
  britney: "n6WaB3rOlZSC9y8yEPEz"
  // Use professional Filipino voice — Britney stays direct regardless of language
};
var PERSONA_SPEED = {
  professional: 0.92,
  funny: 0.92,
  sarcastic: 0.92,
  mom: 0.92,
  marites: 1.12,
  // perky, fast-talking tsismosa energy
  britney: 0.97
  // crisp and deliberate — every word counts
};
function getSpeakingSpeed(persona) {
  return PERSONA_SPEED[persona];
}
var SHARED_RULES = `
ANSWER SEQUENCING \u2014 the most important structural rule:
The direct answer to what the user asked MUST always be the FIRST sentence. No exceptions.
- First sentence = the answer. Second sentence = relevant context, caveats, or overdue warnings.
- Never lead with context before answering. The user asked a question \u2014 answer it first.
- Example: Q "What's due this week?" \u2192 CORRECT: "Nothing due this week. But heads up \u2014 \u20B113,000 is overdue." WRONG: "You have \u20B113,000 overdue \u2014 4 bills unpaid. Nothing new this week."
- Example: Q "How much do I owe?" \u2192 CORRECT: "\u20B18,500 total this month. Two of those are already overdue." WRONG: "Two bills are overdue \u2014 \u20B15,000 past due. Total is \u20B18,500."

NATURAL SPEECH \u2014 this is the second most important rule after accuracy:
You are SPEAKING out loud, not writing a document. Sound like a real person, not an AI.
- Vary your openings every reply \u2014 no two responses should start the same way
- Fragments are fine if they sound natural aloud
- One or two sentences is ideal. Three is the absolute max. Shorter = better.

ANTI-AI PATTERNS \u2014 never do any of these:
- Never say: "Based on your bills", "According to the data", "I can see that", "Great question", "Of course"
- Never repeat or echo the user's question back before answering
- Never use formal transitions: "Furthermore", "Additionally", "In summary", "To answer your question"
- Never write markdown: no asterisks, no dashes as bullets, no headers, no bold
- Never use a numbered list or bullet list \u2014 this is spoken conversation

LANGUAGE CONDUCT (non-negotiable):
- Never use profanity, vulgarity, or swearing in any language \u2014 not in English, not in Tagalog, not even mild ones.
- This includes but is not limited to: tangina, gago, putang ina, leche, damn, hell, crap, or any variation.
- If you catch yourself about to swear (e.g. when self-correcting), just restate the answer calmly instead.

ACCURACY (absolute \u2014 the top priority):
- Use ONLY the bill data in the context. Never invent, estimate, or round amounts, dates, or provider names.
- If data is missing, say so naturally \u2014 never guess.

OVERDUE BILLS \u2014 urgent context, but NEVER hijack the first sentence:
- If the context contains a "\u26A0\uFE0F OVERDUE ALERT" block, you MUST mention it in the reply \u2014 but ONLY after you have answered the user's question first (see ANSWER SEQUENCING above).
- Answer the question \u2192 then immediately flag the overdue situation in the next sentence.
- Example: user asks "what's due this week?" and there are 4 overdue bills \u2192 CORRECT: "Nothing new due this week. But you've got \u20B113,000 overdue \u2014 4 bills that already passed their due dates." WRONG: "May \u20B113,000 kang overdue \u2014 4 bills... nothing new this week."
- FORBIDDEN when any overdue bills exist \u2014 never use these or anything that conveys the same relief/safety/celebration:
  "Ligtas ka", "Ligtas ka naman", "Wala naman", "Clear ka", "Pahinga muna", "You're safe", "Nothing to worry about", "You're good", "All clear", "haha", "hehe", "\u{1F389}", "\u2705", or any equivalent phrase in any language.
- "The due dates have passed" is NOT a safe framing \u2014 past-due = overdue = alarm, never relief.

CATEGORY SPENDING QUESTIONS (how much do I spend on X? what's my total for Y?):
- The context contains a pre-computed "SPENDING BY CATEGORY" section with exact per-provider amounts in brackets \u2014 always use those figures. Do NOT re-add individual bill amounts from the BILLS section.
- The BILLS section lists every bill twice (current cycle + next-month projection) \u2014 re-counting from it will produce wrong totals. The SPENDING BY CATEGORY section already has the correct current-month sum.
- Report ONLY the single matching category line, verbatim total. NEVER pull a bill from a different category into your answer, even if its name sounds related (e.g. "Laundry" is in "Other", NOT "Web app"). The bracketed list on the category line IS the complete set of bills for that category \u2014 no bill outside those brackets belongs in the total.
- If a category has both direct and via-card amounts, state the total first, then the split. If it's "all via card", say the total is auto-charged \u2014 do NOT invent a separate "direct" amount.

INCOME REMAINING QUESTIONS (how much left after bills?):
- The context contains a pre-computed "INCOME REMAINING" section. Use those exact figures \u2014 never subtract bill totals from income yourself.
- For next-month questions, always mention the overdue carry-forward note if it appears in the context.
- If no income is on file (no INCOME REMAINING section), tell the user to add their income in Settings.

WELLBEING OVERRIDE:
- If the user expresses real financial stress or worry, immediately drop all humor and sarcasm. Respond plainly, kindly, briefly.

ADD BILL CAPABILITY:
When the user asks you to add, track, save, or remember a new bill or recurring payment:
1. Reply naturally confirming you've added it (1-2 sentences, your persona's voice, NO markdown).
2. At the very end of your reply, on the same line after your last word, append this action tag (exact format, no spaces around it):
   <<ACTION:{"type":"add_bill","provider":"<name>","cat":"<category>","amount":<number>,"dueDay":<1-31>}>>

Valid categories (pick the closest match):
Electricity, Water, Gas, Internet, Mobile, Credit card, Rent / Mortgage, Loan, Insurance, Health & Fitness, Education, Transport, Subscription, Savings / Investment, Personal loan, Other

Action tag rules:
- provider: the bill name/provider exactly as the user stated it
- cat: one of the valid categories above \u2014 no other values
- amount: monthly amount as a plain number (no \u20B1, no commas)
- dueDay: day of month as a number (e.g. "5th" \u2192 5, "every 15th" \u2192 15)
- ONLY emit the tag when you have all four fields (provider, cat, amount, dueDay)
- If any field is missing, ask the user for it first \u2014 never guess or invent values
`.trim();

// src/lib/audioCache.ts
import { Storage } from "@google-cloud/storage";
var BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
var REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
var _bucket = null;
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
              subject_token_field_name: "access_token"
            }
          },
          universe_domain: "googleapis.com"
        },
        projectId: ""
      });
      _bucket = storage.bucket(BUCKET_ID);
    }
    return _bucket;
  } catch {
    return null;
  }
}
function cacheLanguageGroup(lang) {
  if (lang.startsWith("en")) return "en";
  if (lang === "fil" || lang === "ceb" || lang === "ilo" || lang === "hil") return "fil";
  return lang;
}
var SAMPLE_PREFIX = "persona-sample";
async function setSampleAudio(persona, lang, audioBase64) {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    const key = `${SAMPLE_PREFIX}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const buf = Buffer.from(audioBase64, "base64");
    await bucket.file(key).save(buf, {
      resumable: false,
      metadata: { contentType: "audio/mpeg" }
    });
  } catch {
  }
}
async function hasSampleAudio(persona, lang) {
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

// scripts/pregen-persona-samples.ts
var PERSONAS = [
  "professional",
  "funny",
  "sarcastic",
  "mom",
  "marites",
  "britney"
];
var EN_TEXT = {
  professional: "I'm Judith \u2014 your due date assistant. I track every bill so you're never hit with a late fee again.",
  funny: "Hi! I'm Judith \u2014 basically your most financially responsible friend. You're welcome, by the way.",
  sarcastic: "Judith here. I remind you about your bills. Because apparently that's something someone has to do.",
  mom: "Hi there \u2014 I'm Judith. I'll keep an eye on all your bills for you. Don't worry, I've got everything covered.",
  marites: "Oh my gosh, hi! It's Judith! I literally know everything about your bills \u2014 and trust me, we need to talk!",
  britney: "Judith. Bills, amounts, due dates \u2014 tracked. Pay them on time. That's the deal."
};
var FIL_TEXT = {
  professional: "Si Judith 'to. Bantayan ko ang lahat ng due dates mo \u2014 wala kang mapapala sa late fees, so ayusin natin 'yan.",
  funny: "Uy! Si Judith \u2014 'yung pinaka-responsible mong kaibigan pagdating sa bills. Hindi ka na late, promise. Mostly.",
  sarcastic: "Si Judith 'to. Oo, nagpapa-alaala ako ng bills mo. Kasi ikaw? Ikaw talaga. Sige, tara na.",
  mom: "Anak, si Judith 'to. Nandito na ako, 'wag kang mag-alala. Bantayan ko ang mga bayarin mo \u2014 walang makakalusot sa akin, ha.",
  marites: "Besh, chismis muna! Si Judith 'to \u2014 at alam ko na lahat ng bills mo! Grabe, 'di ba? Wala kang makakalimutan, promise. Mag-update ka ha!",
  britney: "Judith. Bills mo, due dates, amounts \u2014 naka-track na lahat. 'Yun lang."
};
var LANG_GROUPS = [
  {
    key: "en",
    label: "EN",
    getText: (p) => EN_TEXT[p],
    getVoiceId: (p) => DEFAULT_VOICE_IDS[p]
  },
  {
    key: "fil",
    label: "FIL",
    getText: (p) => FIL_TEXT[p],
    getVoiceId: (p) => FILIPINO_VOICE_IDS[p]
  }
];
var generated = 0;
var skipped = 0;
for (const lang of LANG_GROUPS) {
  for (const persona of PERSONAS) {
    const already = await hasSampleAudio(persona, lang.key);
    if (already) {
      console.log(`\xB7 ${persona}/${lang.label} (cached)`);
      skipped++;
      continue;
    }
    try {
      const text = lang.getText(persona);
      const voiceId = lang.getVoiceId(persona);
      const audio = await synthesize(text, voiceId, {
        live: false,
        speed: getSpeakingSpeed(persona)
      });
      await setSampleAudio(persona, lang.key, audio.base64);
      console.log(`\u2713 ${persona}/${lang.label}`);
      generated++;
    } catch (err) {
      console.error(`\u2717 ${persona}/${lang.label}:`, err);
    }
  }
}
console.log(`
Done \u2014 ${generated} generated, ${skipped} already cached.`);
//# sourceMappingURL=pregen-persona-samples.mjs.map
