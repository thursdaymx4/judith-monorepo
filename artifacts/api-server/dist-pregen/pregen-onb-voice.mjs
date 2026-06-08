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
var PREFIX = "onb-voice";
async function setOnbAudio(concept, persona, lang, audioBase64) {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    const key = `${PREFIX}/${concept}/${persona}/${cacheLanguageGroup(lang)}.mp3`;
    const buf = Buffer.from(audioBase64, "base64");
    await bucket.file(key).save(buf, {
      resumable: false,
      metadata: { contentType: "audio/mpeg" }
    });
  } catch {
  }
}
async function hasOnbAudio(concept, persona, lang) {
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

// scripts/pregen-onb-voice.ts
var PERSONAS = ["professional", "funny", "sarcastic", "mom", "marites", "britney"];
var CONCEPTS = [
  "welcome",
  "language",
  "name",
  "lateFee",
  "problem",
  "stakes",
  "intro",
  "features0",
  "features1",
  "features2",
  "paywall",
  "personalizing"
];
var EN_TEXT = {
  welcome: {
    professional: "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    funny: "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    sarcastic: "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    mom: "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    marites: "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    britney: "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?"
  },
  language: {
    professional: "Take control of your bills, take control of your life.",
    funny: "Take control of your bills, take control of your life.",
    sarcastic: "Take control of your bills, take control of your life.",
    mom: "Take control of your bills, take control of your life.",
    marites: "Take control of your bills, take control of your life.",
    britney: "Take control of your bills, take control of your life."
  },
  name: {
    professional: "One more thing \u2014 what should I call you?",
    funny: "One more thing \u2014 what should I call you?",
    sarcastic: "One more thing \u2014 what should I call you?",
    mom: "One more thing \u2014 what should I call you?",
    marites: "One more thing \u2014 what should I call you?",
    britney: "One more thing \u2014 what should I call you?"
  },
  lateFee: {
    professional: "We\u2019ve all been there \u2014 missed a payment, surprise fee. I\u2019m here to make sure that never happens again.",
    funny: "Ugh, late fees \u2014 the worst! I\u2019m here so you never have to deal with that again.",
    sarcastic: "Missed payment. Surprise fee. Happens to everyone. That\u2019s why I\u2019m here.",
    mom: "Anak, don\u2019t worry \u2014 it happens to everyone. I\u2019m here to make sure it doesn\u2019t happen to you again.",
    marites: "Ay grabe, late fees! The absolute worst! But besh, that\u2019s why I\u2019m here \u2014 hindi na maulit iyon!",
    britney: "Missed payment. Late fee. It happens. I\u2019m here to make sure it doesn\u2019t happen again."
  },
  problem: {
    professional: "Honestly, most people don\u2019t track their bills. Let\u2019s change that.",
    funny: "Surprise \u2014 most people don\u2019t track their bills. But you\u2019re not most people anymore!",
    sarcastic: "Most people don\u2019t track this. You\u2019re about to be different.",
    mom: "Anak, most people don\u2019t track their bills. But that\u2019s okay \u2014 we\u2019re changing that right now.",
    marites: "Ay besh, most people don\u2019t track their bills! Pero tayo \u2014 we\u2019re changing that na!",
    britney: "Most people don\u2019t track their bills. You\u2019re changing that."
  },
  stakes: {
    professional: "This doesn\u2019t have to be your situation. Let\u2019s change it \u2014 right now.",
    funny: "Okay! Enough of that \u2014 let\u2019s flip the script! Right now, we change this!",
    sarcastic: "This doesn\u2019t have to stay this way. Let\u2019s change it. Now.",
    mom: "Anak, we\u2019re going to change this together \u2014 starting right now.",
    marites: "Besh! No more of this! We\u2019re changing it right now! Let\u2019s go!",
    britney: "This doesn\u2019t have to stay this way. Change it. Now."
  },
  intro: {
    professional: "This usually takes 5 to 7 minutes. Let\u2019s map out every bill \u2014 I\u2019ll walk you through it.",
    funny: "Okay! About 5 to 7 minutes and your whole bill life will make sense. Let\u2019s go!",
    sarcastic: "About 5 to 7 minutes. Just answer my questions \u2014 it\u2019ll be worth it.",
    mom: "Anak, this will only take 5 to 7 minutes. I\u2019ll walk you through everything, promise.",
    marites: "Grabe besh, 5 to 7 minutes lang! Let\u2019s map all your bills \u2014 I cannot wait!",
    britney: "About 5 to 7 minutes. Answer my questions. I\u2019ll walk you through it."
  },
  features0: {
    professional: "Go ahead \u2014 ask me anything. I\u2019m listening.",
    funny: "I\u2019m all ears! Tap that mic and let\u2019s see what you\u2019ve got.",
    sarcastic: "You can ask me things now. Go ahead.",
    mom: "Go ahead anak, ask me anything. I\u2019m here.",
    marites: "Oh oh oh! Ask me na! I know everything about your bills besh!",
    britney: "Ask me something."
  },
  features1: {
    professional: "Try asking what\u2019s due this week. I\u2019ll give you the full picture.",
    funny: "Try \u2018what\u2019s due this week?\u2019 \u2014 I\u2019ll spill everything, no holding back!",
    sarcastic: "Ask what\u2019s due this week. I\u2019ll tell you.",
    mom: "Try asking what\u2019s due this week anak. I\u2019ll tell you everything.",
    marites: "Ay! Ask me what\u2019s due this week! I\u2019ll tell you everything besh! Lahat!",
    britney: "Ask what\u2019s due this week. I\u2019ll tell you."
  },
  features2: {
    professional: "Ask me if it\u2019s safe to spend before payday. I\u2019ll check your bills and give you a straight answer.",
    funny: "Ask if it\u2019s safe to spend before payday. I\u2019ll be brutally honest \u2014 lovingly, of course!",
    sarcastic: "Ask if it\u2019s safe to spend. I\u2019ll check and give you the truth.",
    mom: "Ask me if it\u2019s safe to spend anak. I\u2019ll check everything for you.",
    marites: "Ask me if it\u2019s safe to spend! I\u2019ll check your bills \u2014 all of them! Grabe besh!",
    britney: "Ask if it\u2019s safe to spend. I\u2019ll check and answer."
  },
  paywall: {
    professional: "You\u2019ve got eight free asks to start. When you\u2019re ready for more, pick a plan and I\u2019m all yours.",
    funny: "Eight free asks \u2014 on the house! Try me out, then come back when you\u2019re hooked. I\u2019ll wait.",
    sarcastic: "Eight free asks. Use them. If you want more, pick a plan.",
    mom: "Anak, you have eight free asks to start. Try them out \u2014 and when you want more, I\u2019ll be right here.",
    marites: "Besh! Eight free asks \u2014 try me! And when you want to keep chatting, pick a plan! I\u2019ll be waiting!",
    britney: "Eight free asks. Use them. Want more \u2014 pick a plan."
  },
  personalizing: {
    professional: "Setting up your reminders now. Almost ready.",
    funny: "Don\u2019t go anywhere \u2014 I\u2019m doing very important things back here!",
    sarcastic: "Yeah yeah, I\u2019m working on it. Give me a second.",
    mom: "Almost ready anak \u2014 I\u2019m making sure everything is just right for you.",
    marites: "Ay grabe, so many bills! But I got you besh \u2014 almost done!",
    britney: "Setting up your reminders. Almost done."
  }
};
var FIL_TEXT = {
  welcome: {
    professional: "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    funny: "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    sarcastic: "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    mom: "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    marites: "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    britney: "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?"
  },
  language: {
    professional: "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    funny: "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    sarcastic: "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    mom: "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    marites: "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    britney: "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?"
  },
  name: {
    professional: "Hi! Can I get your name po?",
    funny: "Hi! Can I get your name po?",
    sarcastic: "Hi! Can I get your name po?",
    mom: "Hi! Can I get your name po?",
    marites: "Hi! Can I get your name po?",
    britney: "Hi! Can I get your name po?"
  },
  lateFee: {
    professional: "Nangyayari ito sa lahat \u2014 napalampas na bayad, biglang multa. Nandito ako para hindi na mangyari ulit.",
    funny: "Ay ang sama ng late fees! Pero wag nang mag-alala \u2014 nandito na ako para hindi na maulit!",
    sarcastic: "Napalampas na bayad. Biglang multa. Nangyayari sa lahat. Kaya nandito ako.",
    mom: "Huwag mag-alala anak. Nangyayari ito sa lahat. Nandito ako para hindi na maulit.",
    marites: "Ay grabe, late fees! Ang pangit! Pero besh, nandito na ako \u2014 hindi na maulit \u2018yan!",
    britney: "Napalampas na bayad. Biglang multa. Nangyayari sa lahat. Kaya nandito ako."
  },
  problem: {
    professional: "Honestly, karamihan sa tao ay hindi nag-ta-track ng bills nila. Palitan na natin iyon.",
    funny: "Grabe, karamihan hindi nag-ta-track ng bills! Pero ikaw \u2014 ikaw ay magiging iba na!",
    sarcastic: "Karamihan hindi nag-ta-track. Ikaw ay magiging iba.",
    mom: "Anak, karamihan hindi nag-ta-track ng bills. Pero okay lang \u2014 palitan na natin iyon ngayon.",
    marites: "Ay besh, karamihan hindi nag-ta-track ng bills! Pero tayo \u2014 we\u2019re changing that na!",
    britney: "Karamihan hindi nag-ta-track. Ikaw ay magiging iba."
  },
  stakes: {
    professional: "Hindi na kailangang ganito ang sitwasyon mo. Palitan na natin ito \u2014 ngayon na.",
    funny: "Sige! Tapos na sa ganyan! Palitan na natin \u2014 ngayon na!",
    sarcastic: "Hindi na kailangang ganito. Palitan na natin. Ngayon.",
    mom: "Anak, magbabago na tayo \u2014 simula ngayon. Sama-sama tayo.",
    marites: "Besh! Tapos na! Palitan na natin ito ngayon! Let\u2019s go!",
    britney: "Hindi na kailangang ganito. Palitan na natin. Ngayon."
  },
  intro: {
    professional: "Aabutin ito ng 5 hanggang 7 minuto. I-map natin ang lahat ng bills mo.",
    funny: "5 hanggang 7 minuto lang at magiging maayos na ang lahat! Tara na!",
    sarcastic: "5 hanggang 7 minuto lang to. Sagutin mo lang ang mga tanong ko.",
    mom: "Anak, 5 hanggang 7 minuto lang ito. Sasamahan kita sa lahat, promise.",
    marites: "Grabe besh, 5 hanggang 7 minuto lang! I-map na natin ang lahat ng bills mo!",
    britney: "5 hanggang 7 minuto lang. Sagutin mo ang mga tanong ko."
  },
  features0: {
    professional: "Sige, magtanong ka na. Nakinukinig ako.",
    funny: "Ready na ako! Magtanong ka na, curious rin ako kung ano ang sasabihin mo!",
    sarcastic: "Pwede ka nang magtanong. Sige.",
    mom: "Sige anak, magtanong ka na. Nandito ako.",
    marites: "Ay ay ay! Magtanong ka na besh! Alam ko lahat ng tungkol sa bills mo!",
    britney: "Magtanong ka na."
  },
  features1: {
    professional: "Try mo i-tanong kung ano ang due ngayong linggo. Sasabihin ko lahat.",
    funny: "I-try mo: \u2018Ano ang due this week?\u2019 \u2014 Isasabi ko lahat, walang tinatago!",
    sarcastic: "Tanungin mo kung ano ang due ngayong linggo. Sasabihin ko.",
    mom: "Try mo anak, tanungin ang due this week. Isasabi ko lahat sa iyo.",
    marites: "Ay! Tanungin mo ako kung ano ang due ngayong linggo! Isasabi ko lahat besh!",
    britney: "Tanungin mo kung ano ang due ngayong linggo. Sasabihin ko."
  },
  features2: {
    professional: "Tanungin mo ko kung ligtas mag-gastos. I-check ko lahat ng bills mo.",
    funny: "Tanungin mo: ligtas ba mag-gastos? Magsasabi ako ng totoo \u2014 mahal kita kaya!",
    sarcastic: "Tanungin mo kung ligtas mag-gastos. Checkuhin ko at sasabihin ko.",
    mom: "Tanungin mo anak kung ligtas mag-gastos. I-check ko lahat para sa iyo.",
    marites: "Tanungin mo ako kung ligtas mag-gastos! Checkuhin ko ang lahat besh! Grabe!",
    britney: "Tanungin mo kung ligtas mag-gastos. Checkuhin ko at sasabihin ko."
  },
  paywall: {
    professional: "May walong libreng tanong ka sa simula. Kapag gusto mo ng higit pa, pumili ng plano \u2014 nandito ako.",
    funny: "Walong libreng tanong \u2014 regalo ko! Subukan mo ako, at kapag hooked ka na, bumalik ka!",
    sarcastic: "Walong libreng tanong. Gamitin mo. Kung gusto mo pa, pumili ng plano.",
    mom: "Anak, may walong libreng tanong ka. Subukan mo \u2014 at kapag gusto mo pa, nandito ako.",
    marites: "Besh! Walong libreng tanong! Subukan mo ako! At kapag gusto mo pang makipag-chat \u2014 pick a plan! Waiting ako!",
    britney: "Walong libreng tanong. Gamitin mo. Gusto mo pa \u2014 pumili ng plano."
  },
  personalizing: {
    // No .fil variant — these send English text through Filipino voices.
    professional: "Setting up your reminders now. Almost ready.",
    funny: "Don\u2019t go anywhere \u2014 I\u2019m doing very important things back here!",
    sarcastic: "Yeah yeah, I\u2019m working on it. Give me a second.",
    mom: "Almost ready anak \u2014 I\u2019m making sure everything is just right for you.",
    marites: "Ay grabe, so many bills! But I got you besh \u2014 almost done!",
    britney: "Setting up your reminders. Almost done."
  }
};
var TRANS = {
  welcome: {
    es: "Hola \u2014 soy Judith, tu asistente de vencimientos. Tomemos el control de tus facturas.",
    pt: "Oi \u2014 eu sou Judith, sua assistente de vencimentos. Vamos tomar o controle das suas contas.",
    "pt-PT": "Ol\xE1 \u2014 sou a Judith, a tua assistente de datas de vencimento. Vamos tomar o controlo das tuas faturas.",
    fr: "Bonjour \u2014 je suis Judith, votre assistante de dates d\u2019\xE9ch\xE9ance. Prenons le contr\xF4le de vos factures.",
    de: "Hallo \u2014 ich bin Judith, Ihre F\xE4lligkeitsdaten-Assistentin. Lassen Sie uns Ihre Rechnungen unter Kontrolle bringen.",
    it: "Ciao \u2014 sono Judith, la tua assistente per le scadenze. Prendiamo il controllo delle tue bollette.",
    nl: "Hoi \u2014 ik ben Judith, uw vervaldatum-assistente. Laten we uw rekeningen onder controle brengen.",
    pl: "Cze\u015B\u0107 \u2014 jestem Judith, twoja asystentka termin\xF3w p\u0142atno\u015Bci. Przejmijmy kontrol\u0119 nad twoimi rachunkami.",
    sv: "Hej \u2014 jag \xE4r Judith, din assistent f\xF6r f\xF6rfallodatum. L\xE5t oss ta kontroll \xF6ver dina r\xE4kningar.",
    da: "Hej \u2014 jeg er Judith, din assistent for forfaldsdatoer. Lad os tage kontrol over dine regninger.",
    no: "Hei \u2014 jeg er Judith, din assistent for forfallsdatoer. La oss ta kontroll over regningene dine.",
    fi: "Hei \u2014 olen Judith, er\xE4p\xE4iv\xE4avustajasi. Otetaan laskusi hallintaan.",
    cs: "Ahoj \u2014 jsem Judith, va\u0161e asistentka pro term\xEDny splatnosti. P\u0159evezm\u011Bme kontrolu nad va\u0161imi \xFA\u010Dty.",
    sk: "Ahoj \u2014 som Judith, va\u0161a asistentka pre term\xEDny splatnosti. Prevezmime kontrolu nad va\u0161imi \xFA\u010Dtami.",
    ro: "Bun\u0103 \u2014 sunt Judith, asistenta ta pentru scaden\u021Be. Hai s\u0103 prel\u0103u\u0103m controlul asupra facturilor tale.",
    bg: "\u0417\u0434\u0440\u0430\u0432\u0435\u0439 \u2014 \u0430\u0437 \u0441\u044A\u043C \u0414\u0436\u0443\u0434\u0438\u0442, \u0442\u0432\u043E\u044F\u0442 \u0430\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u0437\u0430 \u043F\u0430\u0434\u0435\u0436\u0438. \u041D\u0435\u043A\u0430 \u043F\u043E\u0435\u043C\u0435\u043C \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0430 \u043D\u0430\u0434 \u0441\u043C\u0435\u0442\u043A\u0438\u0442\u0435 \u0442\u0438.",
    hr: "Bok \u2014 ja sam Judith, tvoja asistentka za rokove pla\u0107anja. Preuzimimo kontrolu nad tvojim ra\u010Dunima.",
    el: "\u0393\u03B5\u03B9\u03B1 \u2014 \u03B5\u03AF\u03BC\u03B1\u03B9 \u03B7 \u03A4\u03B6\u03BF\u03CD\u03BD\u03C4\u03B9\u03B8, \u03B7 \u03B2\u03BF\u03B7\u03B8\u03CC\u03C2 \u03C3\u03BF\u03C5 \u03B3\u03B9\u03B1 \u03C4\u03B9\u03C2 \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B5\u03C2 \u03BB\u03AE\u03BE\u03B7\u03C2. \u0391\u03C2 \u03C0\u03AC\u03C1\u03BF\u03C5\u03BC\u03B5 \u03C4\u03BF\u03BD \u03AD\u03BB\u03B5\u03B3\u03C7\u03BF \u03C4\u03C9\u03BD \u03BB\u03BF\u03B3\u03B1\u03C1\u03B9\u03B1\u03C3\u03BC\u03CE\u03BD \u03C3\u03BF\u03C5.",
    hu: "Szia \u2014 Judith vagyok, a fizet\xE9si hat\xE1rid\u0151-asszisztensed. Vegy\xFCk k\xE9zbe a sz\xE1ml\xE1idat.",
    uk: "\u041F\u0440\u0438\u0432\u0456\u0442 \u2014 \u044F \u0414\u0436\u0443\u0434\u0456\u0442, \u0432\u0430\u0448 \u043F\u043E\u043C\u0456\u0447\u043D\u0438\u043A \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432 \u043F\u043B\u0430\u0442\u0435\u0436\u0456\u0432. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0432\u0456\u0437\u044C\u043C\u0435\u043C\u043E \u0432\u0430\u0448\u0456 \u0440\u0430\u0445\u0443\u043D\u043A\u0438 \u043F\u0456\u0434 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C.",
    ru: "\u041F\u0440\u0438\u0432\u0435\u0442 \u2014 \u044F \u0414\u0436\u0443\u0434\u0438\u0442, \u0432\u0430\u0448 \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u043F\u043E \u0441\u0440\u043E\u043A\u0430\u043C \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0432\u043E\u0437\u044C\u043C\u0451\u043C \u0432\u0430\u0448\u0438 \u0441\u0447\u0435\u0442\u0430 \u043F\u043E\u0434 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C.",
    tr: "Merhaba \u2014 ben Judith, vade tarihi asistan\u0131n\u0131z\u0131m. Faturalar\u0131n\u0131z\u0131 kontrol alt\u0131na alal\u0131m.",
    ar: "\u0645\u0631\u062D\u0628\u0627\u064B \u2014 \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u0644\u0646\u062A\u062D\u0643\u0645 \u0641\u064A \u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u0645\u0639\u0627\u064B.",
    arz: "\u0623\u0647\u0644\u0627\u064B \u2014 \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0628\u062A\u0627\u0639\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u062E\u0644\u064A\u0646\u0627 \u0646\u062A\u062D\u0643\u0645 \u0641\u064A \u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u0645\u0639 \u0628\u0639\u0636.",
    apc: "\u0645\u0631\u062D\u0628\u0627 \u2014 \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u062E\u0644\u064A\u0646\u0627 \u0646\u062A\u062D\u0643\u0645 \u0628\u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u0645\u0639 \u0628\u0639\u0636.",
    afb: "\u0647\u0644\u0627 \u2014 \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u0646\u0623\u062E\u0630 \u0628\u0632\u0645\u0627\u0645 \u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u0645\u0639 \u0628\u0639\u0636.",
    hi: "\u0928\u092E\u0938\u094D\u0924\u0947 \u2014 \u092E\u0948\u0902 \u091C\u0942\u0921\u093F\u0925 \u0939\u0942\u0901, \u0906\u092A\u0915\u0940 \u0926\u0947\u092F \u0924\u093F\u0925\u093F \u0938\u0939\u093E\u092F\u0915\u0964 \u0906\u0907\u090F \u0905\u092A\u0928\u0947 \u092C\u093F\u0932\u094B\u0902 \u092A\u0930 \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u0923 \u092A\u093E\u090F\u0902\u0964",
    ta: "\u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD \u2014 \u0BA8\u0BBE\u0BA9\u0BCD \u0B9C\u0BC2\u0B9F\u0BBF\u0BA4\u0BCD, \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BA4\u0BB5\u0BA3\u0BC8 \u0BA4\u0BC7\u0BA4\u0BBF \u0B89\u0BA4\u0BB5\u0BBF\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD. \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0B99\u0BCD\u0B95\u0BB3\u0BC8 \u0B95\u0B9F\u0BCD\u0B9F\u0BC1\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0BB5\u0BCB\u0BAE\u0BCD.",
    ja: "\u3053\u3093\u306B\u3061\u306F \u2014 \u30B8\u30E5\u30C7\u30A3\u30B9\u3067\u3059\u3002\u304A\u652F\u6255\u3044\u671F\u65E5\u306E\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3068\u3057\u3066\u3001\u4E00\u7DD2\u306B\u8ACB\u6C42\u66F8\u3092\u7BA1\u7406\u3057\u307E\u3057\u3087\u3046\u3002",
    ko: "\uC548\uB155\uD558\uC138\uC694 \u2014 \uC800\uB294 \uC8FC\uB514\uC2A4\uC608\uC694, \uB0A9\uBD80\uC77C \uB3C4\uC6B0\uBBF8\uC785\uB2C8\uB2E4. \uD568\uAED8 \uCCAD\uAD6C\uC11C\uB97C \uAD00\uB9AC\uD574 \uBD10\uC694.",
    zh: "\u4F60\u597D \u2014 \u6211\u662F\u8339\u8FEA\u4E1D\uFF0C\u4F60\u7684\u8D26\u5355\u5230\u671F\u65E5\u52A9\u624B\u3002\u8BA9\u6211\u4EEC\u4E00\u8D77\u7BA1\u7406\u4F60\u7684\u8D26\u5355\u3002",
    yue: "\u4F60\u597D \u2014 \u6211\u4FC2\u8339\u8FEA\u7D72\uFF0C\u4F60\u5605\u8CEC\u55AE\u5230\u671F\u65E5\u52A9\u624B\u3002\u4E00\u9F4A\u7BA1\u597D\u4F60\u5605\u8CEC\u55AE\u554A\u3002",
    id: "Halo \u2014 aku Judith, asisten tanggal jatuh tempo kamu. Yuk kita kendalikan tagihan kamu bersama.",
    ms: "Hai \u2014 saya Judith, pembantu tarikh matang anda. Jom kita kawal bil-bil anda bersama-sama.",
    vi: "Ch\xE0o \u2014 t\xF4i l\xE0 Judith, tr\u1EE3 l\xFD ng\xE0y \u0111\xE1o h\u1EA1n c\u1EE7a b\u1EA1n. H\xE3y c\xF9ng ki\u1EC3m so\xE1t c\xE1c h\xF3a \u0111\u01A1n c\u1EE7a b\u1EA1n.",
    th: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35 \u2014 \u0E09\u0E31\u0E19\u0E04\u0E37\u0E2D\u0E08\u0E39\u0E14\u0E34\u0E18 \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E14\u0E49\u0E32\u0E19\u0E27\u0E31\u0E19\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E43\u0E2B\u0E49\u0E40\u0E23\u0E32\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1A\u0E34\u0E25\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E14\u0E49\u0E27\u0E22\u0E01\u0E31\u0E19"
  },
  language: {
    es: "Toma el control de tus facturas, toma el control de tu vida.",
    pt: "Tome o controle das suas contas, tome o controle da sua vida.",
    "pt-PT": "Toma o controlo das tuas faturas, toma o controlo da tua vida.",
    fr: "Ma\xEEtrisez vos factures, ma\xEEtrisez votre vie.",
    de: "Behalten Sie Ihre Rechnungen im Griff, behalten Sie Ihr Leben im Griff.",
    it: "Controlla le tue bollette, controlla la tua vita.",
    nl: "Beheer uw rekeningen, beheer uw leven.",
    pl: "Kontroluj swoje rachunki, kontroluj swoje \u017Cycie.",
    sv: "Ta kontroll \xF6ver dina r\xE4kningar, ta kontroll \xF6ver ditt liv.",
    da: "Tag kontrol over dine regninger, tag kontrol over dit liv.",
    no: "Ta kontroll over regningene dine, ta kontroll over livet ditt.",
    fi: "Hallitse laskusi, hallitse el\xE4m\xE4si.",
    cs: "Ovl\xE1dn\u011Bte sv\xE9 \xFA\u010Dty, ovl\xE1dn\u011Bte sv\u016Fj \u017Eivot.",
    sk: "Ovl\xE1dnite svoje \xFA\u010Dty, ovl\xE1dnite svoj \u017Eivot.",
    ro: "Controleaz\u0103-\u021Bi facturile, controleaz\u0103-\u021Bi via\u021Ba.",
    bg: "\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0432\u0430\u0439 \u0441\u043C\u0435\u0442\u043A\u0438\u0442\u0435 \u0441\u0438, \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0432\u0430\u0439 \u0436\u0438\u0432\u043E\u0442\u0430 \u0441\u0438.",
    hr: "Kontroliraj svoje ra\u010Dune, kontroliraj svoj \u017Eivot.",
    el: "\u0388\u03BB\u03B5\u03B3\u03BE\u03B5 \u03C4\u03BF\u03C5\u03C2 \u03BB\u03BF\u03B3\u03B1\u03C1\u03B9\u03B1\u03C3\u03BC\u03BF\u03CD\u03C2 \u03C3\u03BF\u03C5, \u03AD\u03BB\u03B5\u03B3\u03BE\u03B5 \u03C4\u03B7 \u03B6\u03C9\u03AE \u03C3\u03BF\u03C5.",
    hu: "Vedd k\xE9zbe a sz\xE1ml\xE1idat, vedd k\xE9zbe az \xE9letedet.",
    uk: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044E\u0439\u0442\u0435 \u0441\u0432\u043E\u0457 \u0440\u0430\u0445\u0443\u043D\u043A\u0438 \u2014 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E\u0439\u0442\u0435 \u0441\u0432\u043E\u0454 \u0436\u0438\u0442\u0442\u044F.",
    ru: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0432\u043E\u0438 \u0441\u0447\u0435\u0442\u0430 \u2014 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0432\u043E\u044E \u0436\u0438\u0437\u043D\u044C.",
    tr: "Faturalar\u0131n\u0131z\u0131 kontrol edin, hayat\u0131n\u0131z\u0131 kontrol edin.",
    ar: "\u062A\u062D\u0643\u0645\u064A \u0641\u064A \u0641\u0648\u0627\u062A\u064A\u0631\u0643\u060C \u062A\u062D\u0643\u0645\u064A \u0641\u064A \u062D\u064A\u0627\u062A\u0643.",
    arz: "\u062A\u062D\u0643\u0645\u064A \u0641\u064A \u0641\u0648\u0627\u062A\u064A\u0631\u0643\u060C \u062A\u062D\u0643\u0645\u064A \u0641\u064A \u062D\u064A\u0627\u062A\u0643.",
    apc: "\u062A\u062D\u0643\u0645\u064A \u0628\u0641\u0648\u0627\u062A\u064A\u0631\u0643\u060C \u062A\u062D\u0643\u0645\u064A \u0628\u062D\u064A\u0627\u062A\u0643.",
    afb: "\u062A\u062D\u0643\u0645\u064A \u0628\u0641\u0648\u0627\u062A\u064A\u0631\u0643\u060C \u062A\u062D\u0643\u0645\u064A \u0628\u062D\u064A\u0627\u062A\u0643.",
    hi: "\u0905\u092A\u0928\u0947 \u092C\u093F\u0932\u094B\u0902 \u092A\u0930 \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u0923 \u0930\u0916\u0947\u0902, \u0905\u092A\u0928\u0947 \u091C\u0940\u0935\u0928 \u092A\u0930 \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u0923 \u0930\u0916\u0947\u0902\u0964",
    ta: "\u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0B99\u0BCD\u0B95\u0BB3\u0BC8 \u0B95\u0B9F\u0BCD\u0B9F\u0BC1\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD, \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BB5\u0BBE\u0BB4\u0BCD\u0B95\u0BCD\u0B95\u0BC8\u0BAF\u0BC8 \u0B95\u0B9F\u0BCD\u0B9F\u0BC1\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD.",
    ja: "\u652F\u6255\u3044\u3092\u7BA1\u7406\u3059\u308C\u3070\u3001\u751F\u6D3B\u3092\u7BA1\u7406\u3067\u304D\u307E\u3059\u3002",
    ko: "\uCCAD\uAD6C\uC11C\uB97C \uAD00\uB9AC\uD558\uBA74, \uC0B6\uC744 \uAD00\uB9AC\uD560 \uC218 \uC788\uC5B4\uC694.",
    zh: "\u7BA1\u7406\u597D\u8D26\u5355\uFF0C\u5C31\u662F\u7BA1\u7406\u597D\u751F\u6D3B\u3002",
    yue: "\u7BA1\u597D\u8CEC\u55AE\uFF0C\u5C31\u4FC2\u7BA1\u597D\u751F\u6D3B\u3002",
    id: "Kendalikan tagihanmu, kendalikan hidupmu.",
    ms: "Kawal bil anda, kawal kehidupan anda.",
    vi: "Ki\u1EC3m so\xE1t h\xF3a \u0111\u01A1n c\u1EE7a b\u1EA1n, ki\u1EC3m so\xE1t cu\u1ED9c s\u1ED1ng c\u1EE7a b\u1EA1n.",
    th: "\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E1A\u0E34\u0E25\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13"
  },
  name: {
    es: "Una cosa m\xE1s \u2014 \xBFc\xF3mo debo llamarte?",
    pt: "Mais uma coisa \u2014 como devo te chamar?",
    "pt-PT": "Mais uma coisa \u2014 como me devo dirigir a ti?",
    fr: "Encore une chose \u2014 comment dois-je vous appeler?",
    de: "Noch eine Sache \u2014 wie soll ich Sie nennen?",
    it: "Un\u2019ultima cosa \u2014 come devo chiamarti?",
    nl: "Nog \xE9\xE9n ding \u2014 hoe moet ik u noemen?",
    pl: "Jeszcze jedno \u2014 jak mam ci\u0119 nazywa\u0107?",
    sv: "En sak till \u2014 vad ska jag kalla dig?",
    da: "En ting til \u2014 hvad skal jeg kalde dig?",
    no: "En ting til \u2014 hva skal jeg kalle deg?",
    fi: "Viel\xE4 yksi asia \u2014 kuinka minun pit\xE4isi kutsua sinua?",
    cs: "Je\u0161t\u011B jedna v\u011Bc \u2014 jak v\xE1s m\xE1m oslovovat?",
    sk: "E\u0161te jedna vec \u2014 ako v\xE1s m\xE1m oslova\u0165?",
    ro: "\xCEnc\u0103 un lucru \u2014 cum ar trebui s\u0103 te numesc?",
    bg: "\u041E\u0449\u0435 \u0435\u0434\u043D\u043E \u043D\u0435\u0449\u043E \u2014 \u043A\u0430\u043A \u0434\u0430 \u0442\u0435 \u043D\u0430\u0440\u0435\u043A\u0430?",
    hr: "Jo\u0161 jedna stvar \u2014 kako da te zovem?",
    el: "\u0391\u03BA\u03CC\u03BC\u03B1 \u03AD\u03BD\u03B1 \u03C0\u03C1\u03AC\u03B3\u03BC\u03B1 \u2014 \u03C0\u03CE\u03C2 \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C3\u03B5 \u03C6\u03C9\u03BD\u03AC\u03B6\u03C9;",
    hu: "M\xE9g egy dolog \u2014 hogyan sz\xF3l\xEDtsalak?",
    uk: "\u0429\u0435 \u043E\u0434\u043D\u0435 \u2014 \u044F\u043A \u043C\u0435\u043D\u0456 \u0432\u0430\u0441 \u043D\u0430\u0437\u0438\u0432\u0430\u0442\u0438?",
    ru: "\u0415\u0449\u0451 \u043E\u0434\u043D\u043E \u2014 \u043A\u0430\u043A \u043C\u043D\u0435 \u0432\u0430\u0441 \u043D\u0430\u0437\u044B\u0432\u0430\u0442\u044C?",
    tr: "Bir \u015Fey daha \u2014 sizi nas\u0131l \xE7a\u011F\u0131rmal\u0131y\u0131m?",
    ar: "\u0634\u064A\u0621 \u0623\u062E\u064A\u0631 \u2014 \u0643\u064A\u0641 \u064A\u062C\u0628 \u0623\u0646 \u0623\u0646\u0627\u062F\u064A\u0643\u0650?",
    arz: "\u062D\u0627\u062C\u0629 \u062A\u0627\u0646\u064A\u0629 \u2014 \u0623\u0646\u0627 \u0623\u0646\u0627\u062F\u064A \u0639\u0644\u064A\u0643\u0650 \u0625\u0632\u0627\u064A?",
    apc: "\u0634\u064A \u062A\u0627\u0646\u064A \u2014 \u0643\u064A\u0641 \u0644\u0627\u0632\u0645 \u0623\u0646\u0627\u062F\u064A\u0643\u0650?",
    afb: "\u0634\u064A \u062B\u0627\u0646\u064A \u2014 \u0643\u064A\u0641 \u0644\u0627\u0632\u0645 \u0623\u0646\u0627\u062F\u064A\u0643\u0650?",
    hi: "\u090F\u0915 \u0914\u0930 \u092C\u093E\u0924 \u2014 \u092E\u0941\u091D\u0947 \u0906\u092A\u0915\u094B \u0915\u094D\u092F\u093E \u092C\u0941\u0932\u093E\u0928\u093E \u091A\u093E\u0939\u093F\u090F?",
    ta: "\u0B87\u0BA9\u0BCD\u0BA9\u0BCA\u0BB0\u0BC1 \u0BB5\u0BBF\u0BB7\u0BAF\u0BAE\u0BCD \u2014 \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BC8 \u0BA8\u0BBE\u0BA9\u0BCD \u0B8E\u0BA9\u0BCD\u0BA9\u0BB5\u0BC6\u0BA9\u0BCD\u0BB1\u0BC1 \u0B85\u0BB4\u0BC8\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD?",
    ja: "\u3082\u3046\u4E00\u3064 \u2014 \u3042\u306A\u305F\u306E\u3053\u3068\u3092\u3069\u3046\u547C\u3079\u3070\u3088\u3044\u3067\u3059\u304B?",
    ko: "\uD55C \uAC00\uC9C0 \uB354 \u2014 \uC5B4\uB5BB\uAC8C \uBD88\uB7EC \uB4DC\uB9B4\uAE4C\uC694?",
    zh: "\u8FD8\u6709\u4E00\u4EF6\u4E8B \u2014 \u6211\u5E94\u8BE5\u600E\u4E48\u79F0\u547C\u4F60?",
    yue: "\u4EF2\u6709\u4E00\u4EF6\u4E8B \u2014 \u6211\u61C9\u8A72\u9EDE\u7A31\u547C\u4F60\uFF1F",
    id: "Satu hal lagi \u2014 bagaimana aku harus memanggilmu?",
    ms: "Satu lagi perkara \u2014 bagaimana saya harus memanggil anda?",
    vi: "Th\xEAm m\u1ED9t \u0111i\u1EC1u n\u1EEFa \u2014 t\xF4i n\xEAn g\u1ECDi b\u1EA1n l\xE0 g\xEC?",
    th: "\u0E2D\u0E35\u0E01\u0E2A\u0E34\u0E48\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07 \u2014 \u0E09\u0E31\u0E19\u0E04\u0E27\u0E23\u0E40\u0E23\u0E35\u0E22\u0E01\u0E04\u0E38\u0E13\u0E27\u0E48\u0E32\u0E2D\u0E30\u0E44\u0E23?"
  },
  lateFee: {
    es: "Estoy aqu\xED para que nunca vuelvas a llevarte una sorpresa con una mora.",
    pt: "Estou aqui para que voc\xEA nunca seja pega de surpresa por uma multa de atraso.",
    "pt-PT": "Estou aqui para que nunca sejas apanhada de surpresa por uma mora.",
    fr: "Je suis l\xE0 pour que vous ne soyez plus jamais pris par surprise par des p\xE9nalit\xE9s de retard.",
    de: "Ich bin hier, damit Sie nie wieder von einer Verzugsgeb\xFChr \xFCberrascht werden.",
    it: "Sono qui perch\xE9 tu non venga mai pi\xF9 colta di sorpresa da una mora.",
    nl: "Ik ben hier zodat u nooit meer verrast wordt door een late betalingskosten.",
    pl: "Jestem tu, \u017Ceby\u015B nigdy wi\u0119cej nie by\u0142a zaskoczona op\u0142at\u0105 za sp\xF3\u017Anienie.",
    sv: "Jag \xE4r h\xE4r f\xF6r att du aldrig mer ska bli \xF6verraskad av en f\xF6rseningsavgift.",
    da: "Jeg er her, s\xE5 du aldrig mere bliver overrasket af et gebyr for forsinket betaling.",
    no: "Jeg er her slik at du aldri mer blir overrasket av et gebyr for forsinket betaling.",
    fi: "Olen t\xE4\xE4ll\xE4, jotta et koskaan en\xE4\xE4 ylttyisi my\xF6h\xE4stymismaksusta.",
    cs: "Jsem tu, abyste nikdy neby\u010Dte p\u0159ekvapena poplatkem za pozdn\xED platbu.",
    sk: "Som tu, aby v\xE1s nikdy neprekvapil poplatok za ome\u0161kanie.",
    ro: "Sunt aici ca s\u0103 nu fii niciodat\u0103 surprins\u0103 de o penalitate de \xEEnt\xE2rziere.",
    bg: "\u0422\u0443\u043A \u0441\u044A\u043C, \u0437\u0430 \u0434\u0430 \u043D\u0435 \u0442\u0435 \u0438\u0437\u043D\u0435\u043D\u0430\u0434\u0430 \u0442\u0430\u043A\u0441\u0430 \u0437\u0430 \u0437\u0430\u043A\u044A\u0441\u043D\u0435\u043D\u0438\u0435.",
    hr: "Ovdje sam da te nikada vi\u0161e ne iznenadi naknada za ka\u0161njenje.",
    el: "\u0395\u03AF\u03BC\u03B1\u03B9 \u03B5\u03B4\u03CE \u03CE\u03C3\u03C4\u03B5 \u03BD\u03B1 \u03BC\u03B7\u03BD \u03C3\u03B5 \u03B5\u03BA\u03C0\u03BB\u03AE\u03BE\u03B5\u03B9 \u03C0\u03BF\u03C4\u03AD \u03C0\u03AC\u03BB\u03B9 \u03BC\u03B9\u03B1 \u03C7\u03C1\u03AD\u03C9\u03C3\u03B7 \u03BA\u03B1\u03B8\u03C5\u03C3\u03C4\u03AD\u03C1\u03B7\u03C3\u03B7\u03C2.",
    hu: "Az\xE9rt vagyok itt, hogy soha t\xF6bb\xE9 ne lepjen meg egy k\xE9sedelmi d\xEDj.",
    uk: "\u042F \u0442\u0443\u0442, \u0449\u043E\u0431 \u0432\u0430\u0441 \u043D\u0456\u043A\u043E\u043B\u0438 \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u0430\u0441\u0442\u0430\u0432 \u0437\u043D\u0435\u043D\u0430\u0446\u044C\u043A\u0430 \u0448\u0442\u0440\u0430\u0444 \u0437\u0430 \u043F\u0440\u043E\u0441\u0442\u0440\u043E\u0447\u0435\u043D\u043D\u044F.",
    ru: "\u042F \u0437\u0434\u0435\u0441\u044C, \u0447\u0442\u043E\u0431\u044B \u0432\u0430\u0441 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u0430\u0441\u0442\u0430\u043B \u0432\u0440\u0430\u0441\u043F\u043B\u043E\u0445 \u0448\u0442\u0440\u0430\u0444 \u0437\u0430 \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u043A\u0443.",
    tr: "Bir daha asla ge\xE7 \xF6deme \xFCcret s\xFCrpriziyle kar\u015F\u0131la\u015Fmaman\u0131z i\xE7in buradayim.",
    ar: "\u0623\u0646\u0627 \u0647\u0646\u0627 \u062D\u062A\u0649 \u0644\u0627 \u062A\u064F\u0641\u0627\u062C\u0626\u064A\u0643\u0650 \u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0623\u0628\u062F\u0627\u064B \u0645\u0646 \u062C\u062F\u064A\u062F.",
    arz: "\u0623\u0646\u0627 \u0647\u0646\u0627 \u0639\u0634\u0627\u0646 \u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0645\u0627 \u062A\u062A\u0641\u0627\u062C\u0626\u064A\u0643\u0650\u0634 \u062A\u0627\u0646\u064A.",
    apc: "\u0623\u0646\u0627 \u0647\u0648\u0646 \u062D\u062A\u0649 \u0645\u0627 \u064A\u0641\u0627\u062C\u0626\u0648\u0643\u0650 \u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0645\u0646 \u062C\u062F\u064A\u062F.",
    afb: "\u0623\u0646\u0627 \u0647\u0646\u064A \u062D\u062A\u0649 \u0645\u0627 \u062A\u062A\u0641\u0627\u062C\u0626\u064A\u0646 \u0628\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u062B\u0627\u0646\u064A.",
    hi: "\u092E\u0948\u0902 \u092F\u0939\u093E\u0901 \u0939\u0942\u0901 \u0924\u093E\u0915\u093F \u0906\u092A \u0915\u092D\u0940 \u092D\u0940 \u0935\u093F\u0932\u0902\u092C \u0936\u0941\u0932\u094D\u0915 \u0938\u0947 \u091A\u094C\u0902\u0915\u0947 \u0928\u0939\u0940\u0902\u0964",
    ta: "\u0BA4\u0BBE\u0BAE\u0BA4\u0B95\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0BAE\u0BCD \u0B92\u0BB0\u0BC1\u0BAA\u0BCB\u0BA4\u0BC1\u0BAE\u0BCD \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BC8 \u0B86\u0B9A\u0BCD\u0B9A\u0BB0\u0BBF\u0BAF\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4\u0BBE\u0BAE\u0BB2\u0BCD \u0BAA\u0BBE\u0BB0\u0BCD\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BCD\u0B95\u0BCA\u0BB3\u0BCD\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD.",
    ja: "\u4E8C\u5EA6\u3068\u9045\u5EF6\u6599\u91D1\u306B\u99C5\u304B\u3055\u308C\u306A\u3044\u305F\u3081\u306B\u3001\u3053\u3053\u306B\u3044\u307E\u3059\u3002",
    ko: "\uB2E4\uC2DC\uB294 \uC5F0\uCCB4\uB8CC\uC5D0 \uB180\uB77C\uC9C0 \uC54A\uB3C4\uB85D \uC81C\uAC00 \uC5EC\uAE30 \uC788\uC5B4\uC694.",
    zh: "\u6211\u5728\u8FD9\u91CC\uFF0C\u786E\u4FDD\u4F60\u6C38\u8FDC\u4E0D\u4F1A\u88AB\u6EDE\u7EB3\u91D1\u6240\u60CA\u5230\u3002",
    yue: "\u6211\u55BA\u5EA6\uFF0C\u78BA\u4FDD\u4F60\u6C38\u9060\u5594\u4F1A\u4FE3\u6EDE\u7D0D\u91D1\u9A5A\u6BBA\u3002",
    id: "Aku di sini agar kamu tidak pernah lagi terkejut oleh denda keterlambatan.",
    ms: "Saya di sini supaya anda tidak pernah lagi terkejut dengan caj lewat bayar.",
    vi: "T\xF4i \u1EDF \u0111\xE2y \u0111\u1EC3 b\u1EA1n kh\xF4ng bao gi\u1EDD b\u1ECB b\u1EA5t ng\u1EDD b\u1EDFi ph\xED tr\u1EC5 h\u1EA1n n\u1EEFa.",
    th: "\u0E09\u0E31\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E44\u0E1E\u0E23\u0E4C\u0E01\u0E31\u0E1A\u0E04\u0E48\u0E32\u0E1B\u0E23\u0E31\u0E1A\u0E25\u0E48\u0E32\u0E0A\u0E49\u0E2D\u0E35\u0E01\u0E15\u0E48\u0E2D\u0E44\u0E1B"
  },
  problem: {
    es: "La mayor\xEDa de la gente no lleva el control de sus facturas. Cambiemos eso.",
    pt: "A maioria das pessoas n\xE3o acompanha suas contas. Vamos mudar isso.",
    "pt-PT": "A maioria das pessoas n\xE3o acompanha as suas faturas. Vamos mudar isso.",
    fr: "La plupart des gens ne suivent pas leurs factures. Changeons \xE7a.",
    de: "Die meisten Menschen behalten ihre Rechnungen nicht im Blick. \xC4ndern wir das.",
    it: "La maggior parte delle persone non tiene traccia delle proprie bollette. Cambiamo le cose.",
    nl: "De meeste mensen houden hun rekeningen niet bij. Laten we dat veranderen.",
    pl: "Wi\u0119kszo\u015B\u0107 ludzi nie \u015Bledzi swoich rachunk\xF3w. Zmie\u0144my to.",
    sv: "De flesta h\xE5ller inte koll p\xE5 sina r\xE4kningar. L\xE5t oss \xE4ndra p\xE5 det.",
    da: "De fleste holder ikke styr p\xE5 deres regninger. Lad os \xE6ndre det.",
    no: "De fleste holder ikke oversikt over regningene sine. La oss forandre det.",
    fi: "Useimmat ihmiset eiv\xE4t seuraa laskujaan. Muutetaan se.",
    cs: "V\u011Bt\u0161ina lid\xED nesleduje sv\xE9 \xFA\u010Dty. Poj\u010Fme to zm\u011Bnit.",
    sk: "V\xE4\u010D\u0161ina \u013Aud\xED nesleduje svoje \xFA\u010Dty. Po\u010Fme to zmeni\u0165.",
    ro: "Cei mai mul\u021Bi oameni nu \xEE\u015Bi urm\u0103resc facturile. Hai s\u0103 schimb\u0103m asta.",
    bg: "\u041F\u043E\u0432\u0435\u0447\u0435\u0442\u043E \u0445\u043E\u0440\u0430 \u043D\u0435 \u0441\u043B\u0435\u0434\u044F\u0442 \u0441\u043C\u0435\u0442\u043A\u0438\u0442\u0435 \u0441\u0438. \u041D\u0435\u043A\u0430 \u0434\u0430 \u0433\u043E \u043F\u0440\u043E\u043C\u0435\u043D\u0438\u043C.",
    hr: "Ve\u0107ina ljudi ne prati svoje ra\u010Dune. Promijenimo to.",
    el: "\u039F\u03B9 \u03C0\u03B5\u03C1\u03B9\u03C3\u03C3\u03CC\u03C4\u03B5\u03C1\u03BF\u03B9 \u03B4\u03B5\u03BD \u03C0\u03B1\u03C1\u03B1\u03BA\u03BF\u03BB\u03BF\u03C5\u03B8\u03BF\u03CD\u03BD \u03C4\u03BF\u03C5\u03C2 \u03BB\u03BF\u03B3\u03B1\u03C1\u03B9\u03B1\u03C3\u03BC\u03BF\u03CD\u03C2 \u03C4\u03BF\u03C5\u03C2. \u0391\u03C2 \u03B1\u03BB\u03BB\u03AC\u03BE\u03BF\u03C5\u03BC\u03B5 \u03B1\u03C5\u03C4\u03CC.",
    hu: "A legt\xF6bb ember nem k\xF6veti nyomon a sz\xE1ml\xE1it. V\xE1ltoztassunk ezen.",
    uk: "\u0411\u0456\u043B\u044C\u0448\u0456\u0441\u0442\u044C \u043B\u044E\u0434\u0435\u0439 \u043D\u0435 \u0432\u0456\u0434\u0441\u0442\u0435\u0436\u0443\u044E\u0442\u044C \u0441\u0432\u043E\u0457 \u0440\u0430\u0445\u0443\u043D\u043A\u0438. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0437\u043C\u0456\u043D\u0438\u043C\u043E \u0446\u0435.",
    ru: "\u0411\u043E\u043B\u044C\u0448\u0438\u043D\u0441\u0442\u0432\u043E \u043B\u044E\u0434\u0435\u0439 \u043D\u0435 \u0441\u043B\u0435\u0434\u044F\u0442 \u0437\u0430 \u0441\u0432\u043E\u0438\u043C\u0438 \u0441\u0447\u0435\u0442\u0430\u043C\u0438. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043C \u044D\u0442\u043E.",
    tr: "\xC7o\u011Fu insan faturalar\u0131n\u0131 takip etmez. Bunu de\u011Fi\u015Ftirelim.",
    ar: "\u0645\u0639\u0638\u0645 \u0627\u0644\u0646\u0627\u0633 \u0644\u0627 \u064A\u062A\u0627\u0628\u0639\u0648\u0646 \u0641\u0648\u0627\u062A\u064A\u0631\u0647\u0645. \u0644\u0646\u063A\u064A\u0651\u0631 \u0630\u0644\u0643.",
    arz: "\u0645\u0639\u0638\u0645 \u0627\u0644\u0646\u0627\u0633 \u0645\u0634 \u0628\u064A\u062A\u0627\u0628\u0639\u0648\u0627 \u0641\u0648\u0627\u062A\u064A\u0631\u0647\u0645. \u062E\u0644\u064A\u0646\u0627 \u0646\u063A\u064A\u0651\u0631 \u062F\u0647.",
    apc: "\u0645\u0639\u0638\u0645 \u0627\u0644\u0646\u0627\u0633 \u0645\u0627 \u0628\u064A\u062A\u0627\u0628\u0639\u0648\u0627 \u0641\u0648\u0627\u062A\u064A\u0631\u0647\u0645. \u062E\u0644\u064A\u0646\u0627 \u0646\u063A\u064A\u0651\u0631 \u0647\u064A\u0643.",
    afb: "\u0623\u063A\u0644\u0628 \u0627\u0644\u0646\u0627\u0633 \u0645\u0627 \u064A\u062A\u0627\u0628\u0639\u0648\u0646 \u0641\u0648\u0627\u062A\u064A\u0631\u0647\u0645. \u0646\u063A\u064A\u0651\u0631 \u0647\u0630\u0627.",
    hi: "\u091C\u093C\u094D\u092F\u093E\u0926\u093E\u0924\u0930 \u0932\u094B\u0917 \u0905\u092A\u0928\u0947 \u092C\u093F\u0932\u094B\u0902 \u0915\u093E \u091F\u094D\u0930\u0948\u0915 \u0928\u0939\u0940\u0902 \u0930\u0916\u0924\u0947\u0964 \u0906\u0907\u090F \u0907\u0938\u0947 \u092C\u0926\u0932\u0947\u0902\u0964",
    ta: "\u0BAA\u0BC6\u0BB0\u0BC1\u0BAE\u0BCD\u0BAA\u0BBE\u0BB2\u0BBE\u0BA9 \u0BAE\u0B95\u0BCD\u0B95\u0BB3\u0BCD \u0BA4\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0B99\u0BCD\u0B95\u0BB3\u0BC8 \u0B95\u0BA3\u0BCD\u0B95\u0BBE\u0BA3\u0BBF\u0BAA\u0BCD\u0BAA\u0BA4\u0BBF\u0BB2\u0BCD\u0BB2\u0BC8. \u0B87\u0BA4\u0BC8 \u0BAE\u0BBE\u0BB1\u0BCD\u0BB1\u0BC1\u0BB5\u0BCB\u0BAE\u0BCD.",
    ja: "\u307B\u3068\u3093\u3069\u306E\u4EBA\u304C\u8ACB\u6C42\u66F8\u3092\u8FFD\u8DE1\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u305D\u308C\u3092\u5909\u3048\u307E\u3057\u3087\u3046\u3002",
    ko: "\uB300\uBD80\uBD84\uC758 \uC0AC\uB78C\uB4E4\uC740 \uCCAD\uAD6C\uC11C\uB97C \uCD94\uC801\uD558\uC9C0 \uC54A\uC544\uC694. \uADF8\uAC78 \uBC14\uAFFC\uBD10\uC694.",
    zh: "\u5927\u591A\u6570\u4EBA\u4E0D\u8FFD\u8E2A\u81EA\u5DF1\u7684\u8D26\u5355\u3002\u8BA9\u6211\u4EEC\u6765\u6539\u53D8\u8FD9\u4E00\u70B9\u3002",
    yue: "\u5927\u90E8\u5206\u4EBA\u5594\u4F1A\u8FFD\u8E2A\u81EA\u5DF1\u5605\u8CEC\u55AE\u3002\u6211\u54CB\u4E00\u9F4A\u6539\u8B8A\u5462\u500B\u60C5\u6CC1\u3002",
    id: "Kebanyakan orang tidak memantau tagihan mereka. Yuk kita ubah itu.",
    ms: "Kebanyakan orang tidak memantau bil mereka. Jom kita ubah itu.",
    vi: "H\u1EA7u h\u1EBFt m\u1ECDi ng\u01B0\u1EDDi kh\xF4ng theo d\xF5i h\xF3a \u0111\u01A1n c\u1EE7a h\u1ECD. H\xE3y thay \u0111\u1ED5i \u0111i\u1EC1u \u0111\xF3.",
    th: "\u0E04\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E43\u0E2B\u0E0D\u0E48\u0E44\u0E21\u0E48\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E1A\u0E34\u0E25\u0E02\u0E2D\u0E07\u0E15\u0E19\u0E40\u0E2D\u0E07 \u0E43\u0E2B\u0E49\u0E40\u0E23\u0E32\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E34\u0E48\u0E07\u0E19\u0E31\u0E49\u0E19"
  },
  stakes: {
    es: "Cambiemos esto \u2014 ahora mismo.",
    pt: "Vamos mudar isso \u2014 agora mesmo.",
    "pt-PT": "Vamos mudar isto \u2014 agora mesmo.",
    fr: "Changeons \xE7a \u2014 maintenant.",
    de: "\xC4ndern wir das \u2014 jetzt sofort.",
    it: "Cambiamo questo \u2014 adesso.",
    nl: "Laten we dit veranderen \u2014 nu meteen.",
    pl: "Zmie\u0144my to \u2014 teraz.",
    sv: "L\xE5t oss \xE4ndra p\xE5 det h\xE4r \u2014 nu.",
    da: "Lad os \xE6ndre det \u2014 nu.",
    no: "La oss forandre dette \u2014 n\xE5.",
    fi: "Muutetaan t\xE4m\xE4 \u2014 heti nyt.",
    cs: "Poj\u010Fme to zm\u011Bnit \u2014 hned te\u010F.",
    sk: "Po\u010Fme to zmeni\u0165 \u2014 hne\u010F teraz.",
    ro: "Hai s\u0103 schimb\u0103m asta \u2014 chiar acum.",
    bg: "\u041D\u0435\u043A\u0430 \u0434\u0430 \u0433\u043E \u043F\u0440\u043E\u043C\u0435\u043D\u0438\u043C \u2014 \u0441\u0435\u0433\u0430.",
    hr: "Promijenimo to \u2014 odmah.",
    el: "\u0391\u03C2 \u03B1\u03BB\u03BB\u03AC\u03BE\u03BF\u03C5\u03BC\u03B5 \u03B1\u03C5\u03C4\u03CC \u2014 \u03C4\u03CE\u03C1\u03B1.",
    hu: "V\xE1ltoztassunk ezen \u2014 most.",
    uk: "\u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0437\u043C\u0456\u043D\u0438\u043C\u043E \u0446\u0435 \u2014 \u043F\u0440\u044F\u043C\u043E \u0437\u0430\u0440\u0430\u0437.",
    ru: "\u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043C \u044D\u0442\u043E \u2014 \u043F\u0440\u044F\u043C\u043E \u0441\u0435\u0439\u0447\u0430\u0441.",
    tr: "Bunu de\u011Fi\u015Ftirelim \u2014 \u015Fimdi.",
    ar: "\u0644\u0646\u063A\u064A\u0651\u0631 \u0647\u0630\u0627 \u2014 \u0627\u0644\u0622\u0646.",
    arz: "\u062E\u0644\u064A\u0646\u0627 \u0646\u063A\u064A\u0651\u0631 \u062F\u0647 \u2014 \u062F\u0644\u0648\u0642\u062A\u064A.",
    apc: "\u062E\u0644\u064A\u0646\u0627 \u0646\u063A\u064A\u0651\u0631 \u0647\u064A\u0643 \u2014 \u0647\u0644\u0642.",
    afb: "\u0646\u063A\u064A\u0651\u0631 \u0647\u0630\u0627 \u2014 \u0627\u0644\u062D\u064A\u0646.",
    hi: "\u0906\u0907\u090F \u0907\u0938\u0947 \u092C\u0926\u0932\u0947\u0902 \u2014 \u0905\u092D\u0940\u0964",
    ta: "\u0B87\u0BA4\u0BC8 \u0BAE\u0BBE\u0BB1\u0BCD\u0BB1\u0BC1\u0BB5\u0BCB\u0BAE\u0BCD \u2014 \u0B87\u0BAA\u0BCD\u0BAA\u0BCB\u0BA4\u0BC7.",
    ja: "\u3053\u308C\u3092\u5909\u3048\u307E\u3057\u3087\u3046 \u2014 \u4ECA\u3059\u3050\u3002",
    ko: "\uC9C0\uAE08 \uB2F9\uC7A5 \uBC14\uAFFC\uBD10\uC694.",
    zh: "\u8BA9\u6211\u4EEC\u6539\u53D8\u8FD9\u4E00\u5207 \u2014 \u5C31\u662F\u73B0\u5728\u3002",
    yue: "\u6211\u54CB\u800C\u5BB6\u5C31\u6539\u8B8A\u4F6E \u2014 \u4FC2\u6642\u5019\u5587\u3002",
    id: "Yuk kita ubah ini \u2014 sekarang juga.",
    ms: "Jom kita ubah ini \u2014 sekarang.",
    vi: "H\xE3y thay \u0111\u1ED5i \u0111i\u1EC1u n\xE0y \u2014 ngay b\xE2y gi\u1EDD.",
    th: "\u0E43\u0E2B\u0E49\u0E40\u0E23\u0E32\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E34\u0E48\u0E07\u0E19\u0E35\u0E49 \u2014 \u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E40\u0E25\u0E22"
  },
  intro: {
    es: "Esto suele llevar entre 5 y 7 minutos. Te guiar\xE9 en cada paso.",
    pt: "Isso normalmente leva de 5 a 7 minutos. Vou te guiar em tudo.",
    "pt-PT": "Isto normalmente demora entre 5 e 7 minutos. Vou guiar-te em tudo.",
    fr: "\xC7a prend g\xE9n\xE9ralement entre 5 et 7 minutes. Je vous guide \xE0 chaque \xE9tape.",
    de: "Das dauert normalerweise 5 bis 7 Minuten. Ich f\xFChre Sie durch alles.",
    it: "Di solito ci vogliono dai 5 ai 7 minuti. Ti guido in ogni passaggio.",
    nl: "Dit duurt meestal 5 tot 7 minuten. Ik begeleid u bij elke stap.",
    pl: "Zazwyczaj zajmuje to 5 do 7 minut. Przeprowadz\u0119 ci\u0119 przez wszystko.",
    sv: "Det brukar ta 5 till 7 minuter. Jag guidar dig genom allt.",
    da: "Det tager normalt 5 til 7 minutter. Jeg guider dig igennem det hele.",
    no: "Dette tar vanligvis 5 til 7 minutter. Jeg guider deg gjennom alt.",
    fi: "T\xE4m\xE4 kest\xE4\xE4 yleens\xE4 5\u20137 minuuttia. Opastan sinua l\xE4pi kaiken.",
    cs: "To obvykle trv\xE1 5 a\u017E 7 minut. Provedu v\xE1s v\u0161\xEDm.",
    sk: "Zvy\u010Dajne to trv\xE1 5 a\u017E 7 min\xFAt. Prevediem v\xE1s v\u0161etk\xFDm.",
    ro: "De obicei dureaz\u0103 5 p\xE2n\u0103 la 7 minute. Te ghidez prin tot.",
    bg: "\u041E\u0431\u0438\u043A\u043D\u043E\u0432\u0435\u043D\u043E \u043E\u0442\u043D\u0435\u043C\u0430 5 \u0434\u043E 7 \u043C\u0438\u043D\u0443\u0442\u0438. \u0429\u0435 \u0442\u0435 \u043F\u0440\u0435\u0432\u0435\u0434\u0430 \u043F\u0440\u0435\u0437 \u0432\u0441\u0438\u0447\u043A\u043E.",
    hr: "Obi\u010Dno traje 5 do 7 minuta. Provest \u0107u te kroz sve.",
    el: "\u03A3\u03C5\u03BD\u03AE\u03B8\u03C9\u03C2 \u03B4\u03B9\u03B1\u03C1\u03BA\u03B5\u03AF 5 \u03AD\u03C9\u03C2 7 \u03BB\u03B5\u03C0\u03C4\u03AC. \u0398\u03B1 \u03C3\u03B5 \u03BA\u03B1\u03B8\u03BF\u03B4\u03B7\u03B3\u03AE\u03C3\u03C9 \u03C3\u03B5 \u03CC\u03BB\u03B1.",
    hu: "Ez \xE1ltal\xE1ban 5-7 percet vesz ig\xE9nybe. V\xE9gigvezetlek mindenen.",
    uk: "\u0417\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0446\u0435 \u0437\u0430\u0439\u043C\u0430\u0454 5\u20137 \u0445\u0432\u0438\u043B\u0438\u043D. \u042F \u043F\u0440\u043E\u0432\u0435\u0434\u0443 \u0432\u0430\u0441 \u0447\u0435\u0440\u0435\u0437 \u0443\u0441\u0435.",
    ru: "\u041E\u0431\u044B\u0447\u043D\u043E \u044D\u0442\u043E \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442 5\u20137 \u043C\u0438\u043D\u0443\u0442. \u042F \u043F\u0440\u043E\u0432\u0435\u0434\u0443 \u0432\u0430\u0441 \u0447\u0435\u0440\u0435\u0437 \u0432\u0441\u0451.",
    tr: "Bu genellikle 5 ila 7 dakika s\xFCter. Her ad\u0131mda size rehberlik edece\u011Fim.",
    ar: "\u0639\u0627\u062F\u0629\u064B \u0645\u0627 \u064A\u0633\u062A\u063A\u0631\u0642 \u0647\u0630\u0627 \u0645\u0646 5 \u0625\u0644\u0649 7 \u062F\u0642\u0627\u0626\u0642. \u0633\u0623\u0631\u0634\u062F\u0643\u0650 \u062E\u0644\u0627\u0644 \u0643\u0644 \u062E\u0637\u0648\u0629.",
    arz: "\u0639\u0627\u062F\u0629\u064B \u0628\u064A\u0627\u062E\u062F \u0645\u0646 5 \u0644\u0640 7 \u062F\u0642\u0627\u064A\u0642. \u0647\u0631\u0634\u062F\u0643 \u0641\u064A \u0643\u0644 \u062E\u0637\u0648\u0629.",
    apc: "\u0639\u0627\u062F\u0629\u064B \u0628\u064A\u0627\u062E\u062F \u0645\u0646 5 \u0644\u0640 7 \u062F\u0642\u0627\u064A\u0642. \u0631\u062D \u0623\u0631\u0634\u062F\u0643 \u0628\u0643\u0644 \u062E\u0637\u0648\u0629.",
    afb: "\u0639\u0627\u062F\u0629\u064B \u064A\u0623\u062E\u0630 \u0645\u0646 5 \u0644\u0640 7 \u062F\u0642\u0627\u064A\u0642. \u0631\u0627\u062D \u0623\u0631\u0634\u062F\u0643 \u0628\u0643\u0644 \u062E\u0637\u0648\u0629.",
    hi: "\u0907\u0938\u092E\u0947\u0902 \u0906\u092E\u0924\u094C\u0930 \u092A\u0930 5 \u0938\u0947 7 \u092E\u093F\u0928\u091F \u0932\u0917\u0924\u0947 \u0939\u0948\u0902\u0964 \u092E\u0948\u0902 \u0906\u092A\u0915\u094B \u0939\u0930 \u0915\u0926\u092E \u092A\u0930 \u0917\u093E\u0907\u0921 \u0915\u0930\u0942\u0901\u0917\u0940\u0964",
    ta: "\u0B87\u0BA4\u0BC1 \u0BAA\u0BCA\u0BA4\u0BC1\u0BB5\u0BBE\u0B95 5 \u0BAE\u0BC1\u0BA4\u0BB2\u0BCD 7 \u0BA8\u0BBF\u0BAE\u0BBF\u0B9F\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B86\u0B95\u0BC1\u0BAE\u0BCD. \u0BA8\u0BBE\u0BA9\u0BCD \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BC8 \u0BB5\u0BB4\u0BBF\u0BA8\u0B9F\u0BA4\u0BCD\u0BA4\u0BC1\u0BB5\u0BC7\u0BA9\u0BCD.",
    ja: "\u901A\u5E385\u301C7\u5206\u304B\u304B\u308A\u307E\u3059\u3002\u3059\u3079\u3066\u3092\u4E00\u7DD2\u306B\u78BA\u8A8D\u3057\u3066\u3044\u304D\u307E\u3057\u3087\u3046\u3002",
    ko: "\uBCF4\uD1B5 5~7\uBD84 \uC815\uB3C4 \uAC78\uB824\uC694. \uBAA8\uB4E0 \uACFC\uC815\uC744 \uC548\uB0B4\uD574 \uB4DC\uB9B4\uAC8C\uC694.",
    zh: "\u901A\u5E38\u9700\u89815\u523010\u5206\u949F\u3002\u6211\u4F1A\u4E00\u6B65\u4E00\u6B65\u5E26\u4F60\u5B8C\u6210\u3002",
    yue: "\u901A\u5E38\u9700\u89815\u81F37\u5206\u9418\u3002\u6211\u6703\u4E00\u6B65\u4E00\u6B65\u5E36\u4F60\u5B8C\u6210\u3002",
    id: "Ini biasanya membutuhkan 5 hingga 7 menit. Aku akan memandu kamu di setiap langkah.",
    ms: "Ini biasanya mengambil masa 5 hingga 7 minit. Saya akan membimbing anda di setiap langkah.",
    vi: "\u0110i\u1EC1u n\xE0y th\u01B0\u1EDDng m\u1EA5t t\u1EEB 5 \u0111\u1EBFn 7 ph\xFAt. T\xF4i s\u1EBD h\u01B0\u1EDBng d\u1EABn b\u1EA1n t\u1EEBng b\u01B0\u1EDBc.",
    th: "\u0E1B\u0E01\u0E15\u0E34\u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32 5 \u0E16\u0E36\u0E07 7 \u0E19\u0E32\u0E17\u0E35 \u0E09\u0E31\u0E19\u0E08\u0E30\u0E41\u0E19\u0E30\u0E19\u0E33\u0E04\u0E38\u0E13\u0E17\u0E38\u0E01\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19"
  },
  features0: {
    es: "Adelante \u2014 preg\xFAntame lo que quieras. Te escucho.",
    pt: "Pode perguntar \u2014 qualquer coisa. Estou ouvindo.",
    "pt-PT": "Podes perguntar \u2014 qualquer coisa. Estou a ouvir.",
    fr: "Allez-y \u2014 posez-moi n\u2019importe quelle question. Je vous \xE9coute.",
    de: "Fragen Sie mich ruhig \u2014 irgendetwas. Ich h\xF6re zu.",
    it: "Vai pure \u2014 chiedimi quello che vuoi. Sono qui ad ascoltarti.",
    nl: "Ga uw gang \u2014 vraag me van alles. Ik luister.",
    pl: "\u015Amia\u0142o \u2014 zapytaj mnie o cokolwiek. S\u0142ucham.",
    sv: "K\xF6r ig\xE5ng \u2014 fr\xE5ga mig vad som helst. Jag lyssnar.",
    da: "Bare sp\xF8rg \u2014 alt du vil. Jeg lytter.",
    no: "Bare sp\xF8r \u2014 hva som helst. Jeg lytter.",
    fi: "Kysy vain \u2014 mit\xE4 tahansa. Kuuntelen.",
    cs: "Klidn\u011B se ptejte \u2014 cokoliv. Poslouch\xE1m.",
    sk: "K\u013Eudne sa p\xFDtajte \u2014 \u010Dokolwiek. Po\u010D\xFAvam.",
    ro: "D\u0103-i drumul \u2014 \xEEntreba\u0103-m\u0103 orice. Ascult.",
    bg: "\u041F\u0438\u0442\u0430\u0439 \u2014 \u043A\u0430\u043A\u0432\u043E\u0442\u043E \u0438\u0441\u043A\u0430\u0448. \u0421\u043B\u0443\u0448\u0430\u043C.",
    hr: "Slobodno pitaj \u2014 \u0161to god ho\u0107e\u0161. Slu\u0161am.",
    el: "\u03A1\u03CE\u03C4\u03B7\u03C3\u03AD \u03BC\u03B5 \u2014 \u03BF\u03C4\u03B9\u03B4\u03AE\u03C0\u03BF\u03C4\u03B5. \u0391\u03BA\u03BF\u03CD\u03C9.",
    hu: "Csak k\xE9rdezz \u2014 b\xE1rmit. Figyelek.",
    uk: "\u0421\u043C\u0456\u043B\u0438\u0432\u043E \u043F\u0438\u0442\u0430\u0439\u0442\u0435 \u2014 \u0431\u0443\u0434\u044C-\u0449\u043E. \u042F \u0441\u043B\u0443\u0445\u0430\u044E.",
    ru: "\u0421\u043C\u0435\u043B\u043E \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0439\u0442\u0435 \u2014 \u0447\u0442\u043E \u0443\u0433\u043E\u0434\u043D\u043E. \u042F \u0441\u043B\u0443\u0448\u0430\u044E.",
    tr: "Buyurun \u2014 ne olursa sorun. Dinliyorum.",
    ar: "\u062A\u0641\u0636\u0644\u064A \u2014 \u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0639\u0646 \u0623\u064A \u0634\u064A\u0621. \u0623\u0646\u0627 \u0623\u0633\u062A\u0645\u0639.",
    arz: "\u0627\u062A\u0641\u0636\u0644\u064A \u2014 \u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0639\u0644\u0649 \u0623\u064A \u062D\u0627\u062C\u0629. \u0623\u0646\u0627 \u0628\u0633\u0645\u0639\u0643.",
    apc: "\u062A\u0641\u0636\u0644\u064A \u2014 \u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0639\u0646 \u0623\u064A \u0634\u064A. \u0639\u0645 \u0628\u0633\u0645\u0639\u0643.",
    afb: "\u062A\u0641\u0636\u0644\u064A \u2014 \u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0623\u064A \u0634\u064A. \u0623\u0633\u0645\u0639\u0643.",
    hi: "\u092A\u0942\u091B\u093F\u090F \u2014 \u0915\u0941\u091B \u092D\u0940\u0964 \u092E\u0948\u0902 \u0938\u0941\u0928 \u0930\u0939\u0940 \u0939\u0942\u0901\u0964",
    ta: "\u0B95\u0BC7\u0BB3\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u2014 \u0B8E\u0BA4\u0BC1\u0BB5\u0BC1\u0BAE\u0BCD. \u0BA8\u0BBE\u0BA9\u0BCD \u0B95\u0BC7\u0B9F\u0BCD\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD.",
    ja: "\u3069\u3046\u305E \u2014 \u4F55\u3067\u3082\u8074\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u8074\u3044\u3066\u3044\u307E\u3059\u3002",
    ko: "\uBB34\uC5C7\uC774\uB4E0 \uBB3C\uC5B4\uBCF4\uC138\uC694. \uB4E3\uACE0 \uC788\uC5B4\uC694.",
    zh: "\u968F\u65F6\u63D0\u95EE \u2014 \u4EC0\u4E48\u90FD\u53EF\u4EE5\u3002\u6211\u5728\u542C\u3002",
    yue: "\u96A8\u6642\u554F\u6211 \u2014 \u4E5F\u5F97\u3002\u6211\u55BA\u807D\u7DCA\u3002",
    id: "Silakan tanya \u2014 apa saja. Aku mendengarkan.",
    ms: "Sila tanya \u2014 apa sahaja. Saya mendengar.",
    vi: "C\u1EE9 h\u1ECFi \u0111i \u2014 b\u1EA5t c\u1EE9 \u0111i\u1EC1u g\xEC. T\xF4i \u0111ang l\u1EAFng nghe.",
    th: "\u0E16\u0E32\u0E21\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22 \u2014 \u0E2D\u0E30\u0E44\u0E23\u0E01\u0E47\u0E44\u0E14\u0E49 \u0E09\u0E31\u0E19\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1F\u0E31\u0E07\u0E2D\u0E22\u0E39\u0E48"
  },
  features1: {
    es: "Prueba preguntando qu\xE9 vence esta semana. Te digo todo.",
    pt: "Tente perguntar o que vence essa semana. Eu te digo tudo.",
    "pt-PT": "Tenta perguntar o que vence esta semana. Digo-te tudo.",
    fr: "Essayez de me demander ce qui est d\xFB cette semaine. Je vous dis tout.",
    de: "Fragen Sie mich, was diese Woche f\xE4llig ist. Ich sage Ihnen alles.",
    it: "Prova a chiedermi cosa scade questa settimana. Ti dico tutto.",
    nl: "Vraag me wat er deze week vervalt. Ik vertel u alles.",
    pl: "Spr\xF3buj zapyta\u0107, co jest do zap\u0142aty w tym tygodniu. Powiem ci wszystko.",
    sv: "F\xF6rs\xF6k fr\xE5ga vad som f\xF6rfaller den h\xE4r veckan. Jag ber\xE4ttar allt.",
    da: "Pr\xF8v at sp\xF8rge, hvad der forfalder denne uge. Jeg fort\xE6ller dig alt.",
    no: "Pr\xF8v \xE5 sp\xF8rre hva som forfaller denne uken. Jeg forteller deg alt.",
    fi: "Kokeile kysym\xE4\xE4, mitk\xE4 laskut er\xE4\xE4ntyv\xE4t t\xE4ll\xE4 viikolla. Kerron kaiken.",
    cs: "Zkuste se zeptat, co je splatn\xE9 tento t\xFDden. \u0158eknu v\xE1m v\u0161e.",
    sk: "Sk\xFAte sa op\xFDta\u0165, \u010Do je splatn\xE9 tento t\xFD\u017Ede\u0148. Poviem v\xE1m v\u0161etko.",
    ro: "\xCEncerc\u0103 s\u0103 m\u0103 \xEEntrebi ce e scadent s\u0103pt\xE2m\xE2na aceasta. \xCE\u021Bi spun tot.",
    bg: "\u041E\u043F\u0438\u0442\u0430\u0439 \u0434\u0430 \u043C\u0435 \u043F\u043E\u043F\u0438\u0442\u0430\u0448 \u043A\u0430\u043A\u0432\u043E \u0435 \u0434\u044A\u043B\u0436\u0438\u043C\u043E \u0442\u0430\u0437\u0438 \u0441\u0435\u0434\u043C\u0438\u0446\u0430. \u0429\u0435 \u0442\u0438 \u043A\u0430\u0436\u0430 \u0432\u0441\u0438\u0447\u043A\u043E.",
    hr: "Poku\u0161aj me pitati \u0161to dospijeva ovog tjedna. Re\u0107i \u0107u ti sve.",
    el: "\u0394\u03BF\u03BA\u03AF\u03BC\u03B1\u03C3\u03B5 \u03BD\u03B1 \u03BC\u03B5 \u03C1\u03C9\u03C4\u03AE\u03C3\u03B5\u03B9\u03C2 \u03C4\u03B9 \u03BB\u03AE\u03B3\u03B5\u03B9 \u03B1\u03C5\u03C4\u03AE\u03BD \u03C4\u03B7\u03BD \u03B5\u03B2\u03B4\u03BF\u03BC\u03AC\u03B4\u03B1. \u0398\u03B1 \u03C3\u03BF\u03C5 \u03C0\u03C9 \u03C4\u03B1 \u03C0\u03AC\u03BD\u03C4\u03B1.",
    hu: "Pr\xF3b\xE1ld megk\xE9rdezni, mi es\xE9d\xE9kes ezen a h\xE9ten. Mindent elmondok.",
    uk: "\u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0442\u0430\u0442\u0438, \u0449\u043E \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E \u0441\u043F\u043B\u0430\u0442\u0438\u0442\u0438 \u0446\u044C\u043E\u0433\u043E \u0442\u0438\u0436\u043D\u044F. \u042F \u0440\u043E\u0437\u043F\u043E\u0432\u0456\u043C \u0443\u0441\u0435.",
    ru: "\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043F\u0440\u043E\u0441\u0438\u0442\u044C, \u0447\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u043E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u043D\u0430 \u044D\u0442\u043E\u0439 \u043D\u0435\u0434\u0435\u043B\u0435. \u0420\u0430\u0441\u0441\u043A\u0430\u0436\u0443 \u0432\u0441\u0451.",
    tr: "Bu hafta neyin \xF6denece\u011Fini sormay\u0131 deneyin. Her \u015Feyi s\xF6ylerim.",
    ar: "\u062C\u0631\u0651\u0628\u064A \u0623\u0646 \u062A\u0633\u0623\u0644\u064A\u0646\u064A \u0645\u0627 \u0627\u0644\u0630\u064A \u064A\u062D\u0644 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639. \u0633\u0623\u062E\u0628\u0631\u0643\u0650 \u0628\u0643\u0644 \u0634\u064A\u0621.",
    arz: "\u062C\u0631\u0628\u064A \u062A\u0633\u0623\u0644\u064A\u0646\u064A \u0625\u064A\u0647 \u0627\u0644\u0644\u064A \u0628\u064A\u0633\u062A\u062D\u0642 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u062F\u0647. \u0647\u0642\u0648\u0644\u0643 \u0643\u0644 \u062D\u0627\u062C\u0629.",
    apc: "\u062C\u0631\u0628\u064A \u062A\u0633\u0623\u0644\u064A\u0646\u064A \u0634\u0648 \u0628\u064A\u0633\u062A\u062D\u0642 \u0647\u0627\u0644\u0623\u0633\u0628\u0648\u0639. \u0631\u062D \u0623\u062D\u0643\u064A\u0644\u0643 \u0643\u0644 \u0634\u064A.",
    afb: "\u062C\u0631\u0628\u064A \u062A\u0633\u0623\u0644\u064A\u0646\u064A \u0648\u0634 \u064A\u0633\u062A\u062D\u0642 \u0647\u0627\u0644\u0623\u0633\u0628\u0648\u0639. \u0623\u062E\u0628\u0631\u0643 \u0628\u0643\u0644 \u0634\u064A.",
    hi: "\u0907\u0938 \u0939\u092B\u093C\u094D\u0924\u0947 \u0915\u094D\u092F\u093E \u0926\u0947\u092F \u0939\u0948 \u092A\u0942\u091B\u0928\u0947 \u0915\u0940 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964 \u092E\u0948\u0902 \u0938\u092C \u092C\u0924\u093E \u0926\u0942\u0901\u0917\u0940\u0964",
    ta: "\u0B87\u0BA8\u0BCD\u0BA4 \u0BB5\u0BBE\u0BB0\u0BAE\u0BCD \u0B8E\u0BA9\u0BCD\u0BA9 \u0B95\u0BBE\u0BB0\u0BA3\u0BAE\u0BBE\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1 \u0B8E\u0BA9\u0BCD\u0BB1\u0BC1 \u0B95\u0BC7\u0BB3\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD. \u0B8E\u0BB2\u0BCD\u0BB2\u0BBE\u0BB5\u0BB1\u0BCD\u0BB1\u0BC8\u0BAF\u0BC1\u0BAE\u0BCD \u0B9A\u0BCA\u0BB2\u0BCD\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD.",
    ja: "\u4ECA\u9031\u306E\u652F\u6255\u3044\u671F\u65E5\u3092\u8074\u3044\u3066\u307F\u3066\u304F\u3060\u3055\u3044\u3002\u3059\u3079\u3066\u304A\u4F1A\u3048\u3057\u307E\u3059\u3002",
    ko: "\uC774\uBC88 \uC8FC\uC5D0 \uB0A9\uBD80\uD560 \uAC83\uC774 \uBB38\uC9C0 \uBB3C\uC5B4\uBCF4\uC138\uC694. \uC804\uBD80 \uC54C\uB824\uB4DC\uB9B4\uAC8C\uC694.",
    zh: "\u8BD5\u7740\u95EE\u95EE\u8FD9\u5468\u6709\u54EA\u4E9B\u5230\u671F\u8D26\u5355\u3002\u6211\u4F1A\u544A\u8BC9\u4F60\u6240\u6709\u4FE1\u606F\u3002",
    yue: "\u8A66\u4E0B\u554F\u6211\u4ECA\u500B\u661F\u671F\u6709\u54AA\u4E9B\u5230\u671F\u8CEC\u55AE\u3002\u6211\u6703\u8A71\u4F60\u77E5\u6240\u6709\u5955\u3002",
    id: "Coba tanya apa yang jatuh tempo minggu ini. Aku akan ceritakan semuanya.",
    ms: "Cuba tanya apa yang perlu dibayar minggu ini. Saya akan ceritakan segalanya.",
    vi: "Th\u1EED h\u1ECFi nh\u1EEFng g\xEC \u0111\u1EBFn h\u1EA1n tu\u1EA7n n\xE0y. T\xF4i s\u1EBD cho b\u1EA1n bi\u1EBFt t\u1EA5t c\u1EA3.",
    th: "\u0E25\u0E2D\u0E07\u0E16\u0E32\u0E21\u0E27\u0E48\u0E32\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C\u0E19\u0E35\u0E49\u0E21\u0E35\u0E1A\u0E34\u0E25\u0E2D\u0E30\u0E44\u0E23\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E1A\u0E49\u0E32\u0E07 \u0E09\u0E31\u0E19\u0E08\u0E30\u0E1A\u0E2D\u0E01\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07"
  },
  features2: {
    es: "Preg\xFAntame si es seguro gastar antes del cobro. Reviso tus facturas y te doy una respuesta clara.",
    pt: "Pergunte se \xE9 seguro gastar antes do sal\xE1rio. Vejo suas contas e dou uma resposta direta.",
    "pt-PT": "Pergunta se \xE9 seguro gastar antes do sal\xE1rio. Vejo as tuas faturas e dou-te uma resposta clara.",
    fr: "Demandez-moi si c\u2019est prudent de d\xE9penser avant la paie. Je v\xE9rifie et vous donne une r\xE9ponse claire.",
    de: "Fragen Sie, ob es sicher ist, vor dem Zahltag auszugeben. Ich pr\xFCfe alles und gebe Ihnen eine klare Antwort.",
    it: "Chiedimi se \xE8 sicuro spendere prima del giorno di paga. Controllo tutto e ti do una risposta chiara.",
    nl: "Vraag of het veilig is om te besteden voor de salarisdag. Ik controleer alles en geef u een duidelijk antwoord.",
    pl: "Zapytaj mnie, czy bezpiecznie jest wyda\u0107 przed wyp\u0142at\u0105. Sprawdz\u0119 i dam ci jasn\u0105 odpowied\u017A.",
    sv: "Fr\xE5ga om det \xE4r s\xE4kert att spendera f\xF6re l\xF6nedagen. Jag kollar allt och ger dig ett tydligt svar.",
    da: "Sp\xF8rg om det er sikkert at bruge penge f\xF8r l\xF8nningsdagen. Jeg tjekker alt og giver dig et klart svar.",
    no: "Sp\xF8r om det er trygt \xE5 bruke penger f\xF8r l\xF8nningsdagen. Jeg sjekker alt og gir deg et tydelig svar.",
    fi: "Kysy, onko turvallista kuluttaa ennen palkkapaiv\xE4\xE4. Tarkistan kaiken ja annan sinulle selke\xE4n vastauksen.",
    cs: "Zeptejte se, zda je bezpe\u010Dn\xE9 utr\xE1cet p\u0159ed v\xFDplatou. Zkontroluju v\u0161e a d\xE1m v\xE1m jasnou odpov\u011B\u010F.",
    sk: "Op\xFDtajte sa, \u010Di je bezpe\u010Dn\xE9 m\xEDna\u0165 pred v\xFDplatou. Skontrolujem v\u0161etko a d\xE1m v\xE1m jasn\xFA odpove\u010F.",
    ro: "\xCEitreab\u0103-m\u0103 dac\u0103 e sigur s\u0103 cheltuiesti \xEEnainte de ziua de salariu. Verific totul \u015Fi \xEF\u0163i dau un r\u0103spuns clar.",
    bg: "\u041F\u043E\u043F\u0438\u0442\u0430\u0439 \u043C\u0435 \u0434\u0430\u043B\u0438 \u0435 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u0434\u0430 \u0445\u0430\u0440\u0447\u0438\u0448 \u043F\u0440\u0435\u0434\u0438 \u0437\u0430\u043F\u043B\u0430\u0442\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0432\u0430\u043C \u0432\u0441\u0438\u0447\u043A\u043E \u0438 \u0442\u0438 \u0434\u0430\u0432\u0430\u043C \u044F\u0441\u0435\u043D \u043E\u0442\u0433\u043E\u0432\u043E\u0440.",
    hr: "Pitaj me je li sigurno tro\u0161iti prije isplate. Provjerim sve i dam ti jasan odgovor.",
    el: "\u03A1\u03CE\u03C4\u03B7\u03C3\u03AD \u03BC\u03B5 \u03B1\u03BD \u03B5\u03AF\u03BD\u03B1\u03B9 \u03B1\u03C3\u03C6\u03B1\u03BB\u03AD\u03C2 \u03BD\u03B1 \u03BE\u03BF\u03B4\u03AD\u03C8\u03B5\u03B9\u03C2 \u03C0\u03C1\u03B9\u03BD \u03C4\u03B7\u03BD \u03B7\u03BC\u03AD\u03C1\u03B1 \u03C0\u03BB\u03B7\u03C1\u03C9\u03BC\u03AE\u03C2. \u0395\u03BB\u03AD\u03B3\u03C7\u03C9 \u03C4\u03B1 \u03C0\u03AC\u03BD\u03C4\u03B1 \u03BA\u03B1\u03B9 \u03C3\u03BF\u03C5 \u03B4\u03AF\u03BD\u03C9 \u03BC\u03B9\u03B1 \u03BE\u03B5\u03BA\u03AC\u03B8\u03B1\u03C1\u03B7 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7.",
    hu: "K\xE9rdezd meg, hogy biztons\xE1gos-e fizet\xE9snap el\u0151tt p\xE9nzt k\xF6lteni. Mindent ellen\u0151rz\xF6k \xE9s egy\xE9rtelm\u0171 v\xE1laszt adok.",
    uk: "\u0417\u0430\u043F\u0438\u0442\u0430\u0439\u0442\u0435 \u043C\u0435\u043D\u0435, \u0447\u0438 \u0431\u0435\u0437\u043F\u0435\u0447\u043D\u043E \u0432\u0438\u0442\u0440\u0430\u0447\u0430\u0442\u0438 \u043F\u0435\u0440\u0435\u0434 \u0437\u0430\u0440\u043F\u043B\u0430\u0442\u043E\u044E. \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u044E \u0432\u0441\u0435 \u0456 \u0434\u0430\u043C \u0432\u0430\u043C \u0447\u0456\u0442\u043A\u0443 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C.",
    ru: "\u0421\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u043C\u0435\u043D\u044F, \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u043B\u0438 \u0442\u0440\u0430\u0442\u0438\u0442\u044C \u0434\u043E \u0437\u0430\u0440\u043F\u043B\u0430\u0442\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044E \u0432\u0441\u0451 \u0438 \u0434\u0430\u043C \u0447\u0451\u0442\u043A\u0438\u0439 \u043E\u0442\u0432\u0435\u0442.",
    tr: "Ma\xE1\u015F g\xFCn\xFCnden \xF6nce harcama yapman\u0131n g\xFCvenli olup olmad\u0131\u011F\u0131n\u0131 sorun. Her \u015Feyi kontrol edip net bir cevap veririm.",
    ar: "\u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0647\u0644 \u0645\u0646 \u0627\u0644\u0622\u0645\u0646 \u0627\u0644\u0625\u0646\u0641\u0627\u0642 \u0642\u0628\u0644 \u064A\u0648\u0645 \u0627\u0644\u0631\u0627\u062A\u0628. \u0633\u0623\u062A\u062D\u0642\u0642 \u0645\u0646 \u0643\u0644 \u0634\u064A\u0621 \u0648\u0623\u0639\u0637\u064A\u0643\u0650 \u0625\u062C\u0627\u0628\u0629 \u0648\u0627\u0636\u062D\u0629.",
    arz: "\u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0647\u0644 \u0627\u0644\u0625\u0646\u0641\u0627\u0642 \u0622\u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0631\u062A\u0628. \u0647\u062A\u062D\u0642\u0642 \u0645\u0646 \u0643\u0644 \u062D\u0627\u062C\u0629 \u0648\u0623\u062F\u064A\u0643\u0650 \u0625\u062C\u0627\u0628\u0629 \u0648\u0627\u0636\u062D\u0629.",
    apc: "\u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0625\u0646\u0641\u0627\u0642 \u0622\u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0631\u0627\u062A\u0628. \u0631\u062D \u0623\u062A\u062D\u0642\u0642 \u0645\u0646 \u0643\u0644 \u0634\u064A \u0648\u0623\u0639\u0637\u064A\u0643\u0650 \u062C\u0648\u0627\u0628 \u0648\u0627\u0636\u062D.",
    afb: "\u0627\u0633\u0623\u0644\u064A\u0646\u064A \u0625\u0630\u0627 \u0627\u0644\u0625\u0646\u0641\u0627\u0642 \u0622\u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0631\u0627\u062A\u0628. \u0623\u062A\u062D\u0642\u0642 \u0645\u0646 \u0643\u0644 \u0634\u064A \u0648\u0623\u0639\u0637\u064A\u0643 \u062C\u0648\u0627\u0628 \u0635\u0631\u064A\u062D.",
    hi: "\u092E\u0941\u091D\u0938\u0947 \u092A\u0942\u091B\u0947\u0902 \u0915\u093F \u0924\u0928\u0916\u094D\u0935\u093E\u0939 \u0938\u0947 \u092A\u0939\u0932\u0947 \u0916\u0930\u094D\u091A \u0915\u0930\u0928\u093E \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0939\u0948 \u092F\u093E \u0928\u0939\u0940\u0902\u0964 \u092E\u0948\u0902 \u0938\u092C \u091C\u093E\u0901\u091A\u0915\u0930 \u0938\u093E\u092B \u091C\u0935\u093E\u092C \u0926\u0942\u0901\u0917\u0940\u0964",
    ta: "\u0B9A\u0BAE\u0BCD\u0BAA\u0BB3\u0BA4\u0BCD\u0BA4\u0BBF\u0BB1\u0BCD\u0B95\u0BC1 \u0BAE\u0BC1\u0BA9\u0BCD \u0B9A\u0BC6\u0BB2\u0BB5\u0BB4\u0BBF\u0BAA\u0BCD\u0BAA\u0BA4\u0BC1 \u0BAA\u0BBE\u0BA4\u0BC1\u0B95\u0BBE\u0BAA\u0BCD\u0BAA\u0BBE\u0BA9\u0BA4\u0BBE \u0B8E\u0BA9\u0BCD\u0BB1\u0BC1 \u0B95\u0BC7\u0BB3\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD. \u0B8E\u0BB2\u0BCD\u0BB2\u0BBE\u0BB5\u0BB1\u0BCD\u0BB1\u0BC8\u0BAF\u0BC1\u0BAE\u0BCD \u0B9A\u0BB0\u0BBF\u0BAA\u0BBE\u0BB0\u0BCD\u0BA4\u0BCD\u0BA4\u0BC1 \u0BA4\u0BC6\u0BB3\u0BBF\u0BB5\u0BBE\u0BA9 \u0BAA\u0BA4\u0BBF\u0BB2\u0BCD \u0BA4\u0BB0\u0BC1\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD.",
    ja: "\u7D66\u6599\u65E5\u524D\u306B\u4F7F\u3063\u3066\u3082\u5927\u4E08\u592B\u304B\u8074\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u3059\u3079\u3066\u78BA\u8A8D\u3057\u3066\u660E\u78BA\u306A\u7B54\u3048\u3092\u304A\u4F1D\u3048\u3057\u307E\u3059\u3002",
    ko: "\uC6D4\uAE09\uB0A0 \uC804\uC5D0 \uC368\uB3C4 \uB418\uB294\uC9C0 \uBB3C\uC5B4\uBCF4\uC138\uC694. \uBAA8\uB450 \uD655\uC778\uD558\uACE0 \uBA85\uD655\uD55C \uB2F5\uC744 \uB4DC\uB9B4\uAC8C\uC694.",
    zh: "\u95EE\u95EE\u6211\u53D1\u85AA\u65E5\u524D\u662F\u5426\u53EF\u4EE5\u5B89\u5168\u6D88\u8D39\u3002\u6211\u4F1A\u68C0\u67E5\u4E00\u5207\u5E76\u7ED9\u4F60\u660E\u786E\u7684\u7B54\u6848\u3002",
    yue: "\u554F\u4E0B\u6211\u51FA\u7CAE\u524D\u4FC2\u5514\u4FC2\u53EF\u4EE5\u5B89\u5168\u6D88\u8CBB\u3002\u6211\u6703\u67E5\u6652\u6240\u6709\u5955\uFF0C\u518D\u7D66\u4F60\u4E00\u500B\u6E05\u6670\u7684\u7B54\u6848\u3002",
    id: "Tanya aku apakah aman menghabiskan uang sebelum gajian. Aku periksa semua dan berikan jawaban yang jelas.",
    ms: "Tanya saya sama ada selamat untuk berbelanja sebelum hari gaji. Saya semak semuanya dan beri anda jawapan yang jelas.",
    vi: "H\u1ECFi t\xF4i li\u1EC7u c\xF3 an to\xE0n \u0111\u1EC3 chi ti\xEAu tr\u01B0\u1EDBc ng\xE0y l\u01B0\u01A1ng kh\xF4ng. T\xF4i ki\u1EC3m tra t\u1EA5t c\u1EA3 v\xE0 \u0111\u01B0a ra c\xE2u tr\u1EA3 l\u1EDDi r\xF5 r\xE0ng.",
    th: "\u0E16\u0E32\u0E21\u0E09\u0E31\u0E19\u0E27\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22\u0E01\u0E48\u0E2D\u0E19\u0E27\u0E31\u0E19\u0E40\u0E07\u0E34\u0E19\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22\u0E44\u0E2B\u0E21 \u0E09\u0E31\u0E19\u0E08\u0E30\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E41\u0E25\u0E30\u0E43\u0E2B\u0E49\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E17\u0E35\u0E48\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19"
  },
  paywall: {
    es: "Tienes ocho preguntas gratuitas para empezar. Cuando quieras m\xE1s, elige un plan.",
    pt: "Voc\xEA tem oito perguntas gratuitas para come\xE7ar. Quando quiser mais, escolha um plano.",
    "pt-PT": "Tens oito perguntas gratuitas para come\xE7ar. Quando quiseres mais, escolhe um plano.",
    fr: "Vous avez huit questions gratuites pour commencer. Quand vous en voulez plus, choisissez un plan.",
    de: "Sie haben acht kostenlose Fragen zum Start. Wenn Sie mehr m\xF6chten, w\xE4hlen Sie einen Plan.",
    it: "Hai otto domande gratuite per iniziare. Quando vuoi di pi\xF9, scegli un piano.",
    nl: "U heeft acht gratis vragen om mee te beginnen. Als u meer wilt, kies dan een abonnement.",
    pl: "Masz osiem darmowych pyta\u0144 na start. Kiedy b\u0119dziesz chcia\u0142a wi\u0119cej, wybierz plan.",
    sv: "Du har \xE5tta gratisf\xE5gor att b\xF6rja med. N\xE4r du vill ha mer, v\xE4lj en plan.",
    da: "Du har otte gratis sp\xF8rgsm\xE5l at starte med. N\xE5r du vil have mere, v\xE6lg en plan.",
    no: "Du har \xE5tte gratis sp\xF8rsm\xE5l \xE5 starte med. N\xE5r du vil ha mer, velg en plan.",
    fi: "Sinulla on kahdeksan ilmaista kysymyst\xE4 aloittaaksesi. Kun haluat lis\xE4\xE4, valitse suunnitelma.",
    cs: "M\xE1te osm bezplatn\xFDch ot\xE1zek pro za\u010D\xE1tek. A\u017E budete cht\xEDt v\xEDce, vyberte si pl\xE1n.",
    sk: "M\xE1te osem bezplatn\xFDch ot\xE1zok na za\u010Diatok. Ke\u010F budete chcie\u0165 viac, vyberte si pl\xE1n.",
    ro: "Ai opt \xEEntreb\u0103ri gratuite pentru \xEEnceput. C\xE2nd vrei mai mult, alege un plan.",
    bg: "\u0418\u043C\u0430\u0448 \u043E\u0441\u0435\u043C \u0431\u0435\u0437\u043F\u043B\u0430\u0442\u043D\u0438 \u0432\u044A\u043F\u0440\u043E\u0441\u0430 \u0437\u0430 \u043D\u0430\u0447\u0430\u043B\u043E. \u041A\u043E\u0433\u0430\u0442\u043E \u0438\u0441\u043A\u0430\u0448 \u043F\u043E\u0432\u0435\u0447\u0435, \u0438\u0437\u0431\u0435\u0440\u0438 \u043F\u043B\u0430\u043D.",
    hr: "Ima\u0161 osam besplatnih pitanja za po\u010Detak. Kad bude\u0161 htjela vi\u0161e, odaberi plan.",
    el: "\u0388\u03C7\u03B5\u03B9\u03C2 \u03BF\u03BA\u03C4\u03CE \u03B4\u03C9\u03C1\u03B5\u03AC\u03BD \u03B5\u03C1\u03C9\u03C4\u03AE\u03C3\u03B5\u03B9\u03C2 \u03B3\u03B9\u03B1 \u03B1\u03C1\u03C7\u03AE. \u038C\u03C4\u03B1\u03BD \u03B8\u03AD\u03BB\u03B5\u03B9\u03C2 \u03C0\u03B5\u03C1\u03B9\u03C3\u03C3\u03CC\u03C4\u03B5\u03C1\u03B5\u03C2, \u03B5\u03C0\u03AD\u03BB\u03B5\u03BE\u03B5 \u03AD\u03BD\u03B1 \u03C0\u03C1\u03CC\u03B3\u03C1\u03B1\u03BC\u03BC\u03B1.",
    hu: "Nyolc ingyenes k\xE9rd\xE9sed van a kezd\xE9shez. Ha t\xF6bbet szeretn\xE9l, v\xE1lassz egy csomagot.",
    uk: "\u0423 \u0432\u0430\u0441 \u0454 \u0432\u0456\u0441\u0456\u043C \u0431\u0435\u0437\u043A\u043E\u0448\u0442\u043E\u0432\u043D\u0438\u0445 \u0437\u0430\u043F\u0438\u0442\u0430\u043D\u044C \u0434\u043B\u044F \u043F\u043E\u0447\u0430\u0442\u043A\u0443. \u041A\u043E\u043B\u0438 \u0437\u0430\u0445\u043E\u0447\u0435\u0442\u0435 \u0431\u0456\u043B\u044C\u0448\u0435, \u043E\u0431\u0435\u0440\u0456\u0442\u044C \u043F\u043B\u0430\u043D.",
    ru: "\u0423 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u0432\u043E\u0441\u0435\u043C\u044C \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u0434\u043B\u044F \u043D\u0430\u0447\u0430\u043B\u0430. \u041A\u043E\u0433\u0434\u0430 \u0437\u0430\u0445\u043E\u0442\u0438\u0442\u0435 \u0431\u043E\u043B\u044C\u0448\u0435, \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0430\u0440\u0438\u0444.",
    tr: "Ba\u015Flamak i\xE7in sekiz \xFCcretsiz sorunuz var. Daha fazlas\u0131n\u0131 istedi\u011Finizde bir plan se\xE7in.",
    ar: "\u0644\u062F\u064A\u0643\u0650 \u062B\u0645\u0627\u0646\u064A\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u0644\u0644\u0628\u062F\u0621. \u0639\u0646\u062F\u0645\u0627 \u062A\u0631\u064A\u062F\u064A\u0646 \u0627\u0644\u0645\u0632\u064A\u062F, \u0627\u062E\u062A\u0627\u0631\u064A \u062E\u0637\u0629.",
    arz: "\u0639\u0646\u062F\u0643 \u062A\u0645\u0627\u0646\u064A\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u062A\u0628\u062F\u0626\u064A \u0628\u064A\u0647\u0627. \u0644\u0645\u0627 \u062A\u064A\u062C\u064A \u062A\u0639\u0645\u0644\u064A \u0625\u064A\u0647\u060C \u0627\u062E\u062A\u0627\u0631\u064A \u062E\u0637\u0629.",
    apc: "\u0639\u0646\u062F\u0643 \u062A\u0645\u0627\u0646\u064A\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u0644\u062A\u0628\u062F\u0626\u064A. \u0644\u0645\u0627 \u0628\u062F\u0643 \u0623\u0643\u062B\u0631, \u0627\u062E\u062A\u0627\u0631\u064A \u062E\u0637\u0629.",
    afb: "\u0639\u0646\u062F\u0643 \u062B\u0645\u0627\u0646\u064A\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u062A\u0628\u062F\u0626\u064A\u0646 \u0641\u064A\u0647\u0627. \u0644\u0645\u0627 \u062A\u0628\u064A\u0646 \u0623\u0643\u062B\u0631, \u0627\u062E\u062A\u0627\u0631\u064A \u062E\u0637\u0629.",
    hi: "\u0906\u092A\u0915\u0947 \u092A\u093E\u0938 \u0936\u0941\u0930\u0941\u0906\u0924 \u0915\u0947 \u0932\u093F\u090F \u0906\u0920 \u092E\u0941\u092B\u093C\u094D\u0924 \u0938\u0935\u093E\u0932 \u0939\u0948\u0902\u0964 \u091C\u092C \u0914\u0930 \u091A\u093E\u0939\u093F\u090F, \u0915\u094B\u0908 \u092A\u094D\u0932\u093E\u0928 \u091A\u0941\u0928\u0947\u0902\u0964",
    ta: "\u0BA4\u0BCA\u0B9F\u0B99\u0BCD\u0B95\u0BC1\u0BB5\u0BA4\u0BB1\u0BCD\u0B95\u0BC1 \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BBF\u0B9F\u0BAE\u0BCD \u0B8E\u0B9F\u0BCD\u0B9F\u0BC1 \u0B87\u0BB2\u0BB5\u0B9A \u0B95\u0BC7\u0BB3\u0BCD\u0BB5\u0BBF\u0B95\u0BB3\u0BCD \u0B89\u0BB3\u0BCD\u0BB3\u0BA9. \u0BAE\u0BC7\u0BB2\u0BC1\u0BAE\u0BCD \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD\u0BAA\u0BCB\u0BA4\u0BC1 \u0BA4\u0BBF\u0B9F\u0BCD\u0B9F\u0BAE\u0BCD \u0BA4\u0BC7\u0BB0\u0BCD\u0BA8\u0BCD\u0BA4\u0BC6\u0B9F\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD.",
    ja: "\u6700\u521D\u306B8\u3064\u306E\u7121\u6599\u8CEA\u554F\u304C\u3042\u308A\u307E\u3059\u3002\u3082\u3063\u3068\u4F7F\u3044\u305F\u3044\u3068\u304D\u306F\u30D7\u30E9\u30F3\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
    ko: "\uC2DC\uC791\uD560 \uB54C 8\uAC1C\uC758 \uBB34\uB8CC \uC9C8\uBB38\uC774 \uC788\uC5B4\uC694. \uB354 \uC6D0\uD558\uC2DC\uBA74 \uD50C\uB79C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.",
    zh: "\u4F60\u6709\u516B\u4E2A\u514D\u8D39\u95EE\u9898\u53EF\u4EE5\u5F00\u59CB\u4F7F\u7528\u3002\u60F3\u8981\u66F4\u591A\u65F6\uFF0C\u8BF7\u9009\u62E9\u4E00\u4E2A\u65B9\u6848\u3002",
    yue: "\u4F60\u6709\u516B\u500B\u514D\u8CBB\u554F\u984C\u53EF\u4EE5\u958B\u59CB\u4F7F\u7528\u3002\u60F3\u8981\u66F4\u591A\u5605\u6642\u5019\uFF0C\u63C1\u4E00\u500B\u65B9\u6848\u3002",
    id: "Kamu punya delapan pertanyaan gratis untuk memulai. Ketika mau lebih, pilih paket.",
    ms: "Anda mempunyai lapan soalan percuma untuk bermula. Apabila mahu lebih, pilih pelan.",
    vi: "B\u1EA1n c\xF3 t\xE1m c\xE2u h\u1ECFi mi\u1EC5n ph\xED \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u. Khi mu\u1ED1n th\xEAm, h\xE3y ch\u1ECDn m\u1ED9t g\xF3i.",
    th: "\u0E04\u0E38\u0E13\u0E21\u0E35\u0E04\u0E33\u0E16\u0E32\u0E21\u0E1F\u0E23\u0E35\u0E41\u0E1B\u0E14\u0E02\u0E49\u0E2D\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19 \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21 \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E41\u0E1C\u0E19"
  },
  personalizing: {
    es: "Configurando tus recordatorios. Ya casi est\xE1.",
    pt: "Configurando seus lembretes. J\xE1 quase pronto.",
    "pt-PT": "A configurar os teus lembretes. J\xE1 est\xE1 quase.",
    fr: "Configuration de vos rappels en cours. Presque pr\xEAt.",
    de: "Ich richte Ihre Erinnerungen ein. Gleich fertig.",
    it: "Sto configurando i tuoi promemoria. Quasi pronto.",
    nl: "Uw herinneringen worden ingesteld. Bijna klaar.",
    pl: "Konfiguruj\u0119 twoje przypomnienia. Prawie gotowe.",
    sv: "Konfigurerar dina p\xE5minnelser. Snart klar.",
    da: "Ops\xE6tter dine p\xE5minnelser. N\xE6sten f\xE6rdig.",
    no: "Setter opp p\xE5minnelsene dine. Nesten ferdig.",
    fi: "Asetan muistutuksesi. Melkein valmis.",
    cs: "Nastavuji va\u0161e p\u0159ipom\xEDnky. T\xE9m\u011B\u0159 hotovo.",
    sk: "Nastavujem va\u0161e pripomienky. Takmer hotovo.",
    ro: "Configurez mementourile tale. Aproape gata.",
    bg: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0432\u0430\u043C \u043D\u0430\u043F\u043E\u043C\u043D\u044F\u043D\u0438\u044F\u0442\u0430 \u0442\u0438. \u041F\u043E\u0447\u0442\u0438 \u0433\u043E\u0442\u043E\u0432\u043E.",
    hr: "Postavljam tvoje podsjetnicke. Skoro gotovo.",
    el: "\u03A1\u03C5\u03B8\u03BC\u03AF\u03B6\u03C9 \u03C4\u03B9\u03C2 \u03C5\u03C0\u03B5\u03BD\u03B8\u03C5\u03BC\u03AF\u03C3\u03B5\u03B9\u03C2 \u03C3\u03BF\u03C5. \u03A3\u03C7\u03B5\u03B4\u03CC\u03BD \u03AD\u03C4\u03BF\u03B9\u03BC\u03BF.",
    hu: "Be\xE1ll\xEDtom az eml\xE9keztet\u0151idet. Majdnem k\xE9sz.",
    uk: "\u041D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0443\u044E \u0432\u0430\u0448\u0456 \u043D\u0430\u0433\u0430\u0434\u0443\u0432\u0430\u043D\u043D\u044F. \u041C\u0430\u0439\u0436\u0435 \u0433\u043E\u0442\u043E\u0432\u043E.",
    ru: "\u041D\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u044E \u0432\u0430\u0448\u0438 \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F. \u041F\u043E\u0447\u0442\u0438 \u0433\u043E\u0442\u043E\u0432\u043E.",
    tr: "Hat\u0131rlatmalar\u0131n\u0131z ayarlan\u0131yor. Neredeyse haz\u0131r.",
    ar: "\u0623\u0642\u0648\u0645 \u0628\u0625\u0639\u062F\u0627\u062F \u062A\u0630\u0643\u064A\u0631\u0627\u062A\u0643. \u062A\u0642\u0631\u064A\u0628\u0627\u064B \u062C\u0627\u0647\u0632.",
    arz: "\u0628\u062C\u0647\u0651\u0632 \u062A\u0630\u0643\u064A\u0631\u0627\u062A\u0643. \u062A\u0642\u0631\u064A\u0628\u0627\u064B \u062E\u0644\u0635\u0646\u0627.",
    apc: "\u0639\u0645 \u0628\u062C\u0647\u0651\u0632 \u062A\u0630\u0643\u064A\u0631\u0627\u062A\u0643. \u062A\u0642\u0631\u064A\u0628\u0627\u064B \u062C\u0627\u0647\u0632.",
    afb: "\u0623\u062C\u0647\u0651\u0632 \u062A\u0630\u0643\u064A\u0631\u0627\u062A\u0643. \u062A\u0642\u0631\u064A\u0628\u0627\u064B \u062C\u0627\u0647\u0632.",
    hi: "\u0906\u092A\u0915\u0947 \u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930 \u0938\u0947\u091F \u0939\u094B \u0930\u0939\u0947 \u0939\u0948\u0902\u0964 \u0932\u0917\u092D\u0917 \u0924\u0948\u092F\u093E\u0930\u0964",
    ta: "\u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BA8\u0BBF\u0BA9\u0BC8\u0BB5\u0BC2\u0B9F\u0BCD\u0B9F\u0BB2\u0BCD\u0B95\u0BB3\u0BC8 \u0B85\u0BAE\u0BC8\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD. \u0B95\u0BBF\u0B9F\u0BCD\u0B9F\u0BA4\u0BCD\u0BA4\u0B9F\u0BCD \u0BA4\u0BAF\u0BBE\u0BB0\u0BCD.",
    ja: "\u30EA\u30DE\u30A4\u30F3\u30C0\u30FC\u3092\u8A2D\u5B9A\u3057\u3066\u3044\u307E\u3059\u3002\u3082\u3046\u3059\u3050\u5B8C\u4E86\u3067\u3059\u3002",
    ko: "\uC54C\uB9BC\uC744 \uC124\uC815\uD558\uACE0 \uC788\uC5B4\uC694. \uAC70\uC758 \uB2E4 \uB410\uC5B4\uC694.",
    zh: "\u6B63\u5728\u8BBE\u7F6E\u4F60\u7684\u63D0\u9192\u3002\u5FEB\u597D\u4E86\u3002",
    yue: "\u6B63\u5728\u8A2D\u5B9A\u4F60\u5605\u63D0\u9192\u3002\u5FEB\u597D\u5561\u3002",
    id: "Mengatur pengingatmu. Hampir selesai.",
    ms: "Menetapkan peringatan anda. Hampir selesai.",
    vi: "\u0110ang thi\u1EBFt l\u1EADp l\u1EDDi nh\u1EAFc c\u1EE7a b\u1EA1n. S\u1EAFp xong r\u1ED3i.",
    th: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E40\u0E01\u0E37\u0E2D\u0E1A\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27"
  }
};
var OTHER_LANGS = Object.keys(TRANS.welcome);
async function main() {
  const total = CONCEPTS.length * PERSONAS.length * (2 + OTHER_LANGS.length);
  console.log(`
Judith onboarding voice pre-generator`);
  console.log(`Target: ${CONCEPTS.length} concepts \xD7 ${PERSONAS.length} personas \xD7 ${2 + OTHER_LANGS.length} lang groups = ${total} files
`);
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const concept of CONCEPTS) {
    for (const persona of PERSONAS) {
      const speed = getSpeakingSpeed(persona);
      {
        const lang = "en";
        const text = EN_TEXT[concept][persona];
        const voiceId = DEFAULT_VOICE_IDS[persona];
        if (await hasOnbAudio(concept, persona, lang)) {
          skipped++;
          process.stdout.write(`  skip  ${concept}/${persona}/${lang}\r`);
        } else {
          try {
            const audio = await synthesize(text, voiceId, { live: false, speed });
            await setOnbAudio(concept, persona, lang, audio.base64);
            done++;
            console.log(`  [${done + skipped + failed}/${total}] \u2713 ${concept}/${persona}/${lang}`);
          } catch (err) {
            failed++;
            console.error(`  [${done + skipped + failed}/${total}] \u2717 ${concept}/${persona}/${lang}:`, err.message);
          }
        }
      }
      {
        const lang = "fil";
        const text = FIL_TEXT[concept][persona];
        const voiceId = FILIPINO_VOICE_IDS[persona];
        if (await hasOnbAudio(concept, persona, lang)) {
          skipped++;
          process.stdout.write(`  skip  ${concept}/${persona}/${lang}\r`);
        } else {
          try {
            const audio = await synthesize(text, voiceId, { live: false, speed });
            await setOnbAudio(concept, persona, lang, audio.base64);
            done++;
            console.log(`  [${done + skipped + failed}/${total}] \u2713 ${concept}/${persona}/${lang}`);
          } catch (err) {
            failed++;
            console.error(`  [${done + skipped + failed}/${total}] \u2717 ${concept}/${persona}/${lang}:`, err.message);
          }
        }
      }
      for (const lang of OTHER_LANGS) {
        const text = TRANS[concept]?.[lang];
        if (!text) {
          skipped++;
          continue;
        }
        const voiceId = DEFAULT_VOICE_IDS[persona];
        if (await hasOnbAudio(concept, persona, lang)) {
          skipped++;
          process.stdout.write(`  skip  ${concept}/${persona}/${lang}\r`);
          continue;
        }
        try {
          const audio = await synthesize(text, voiceId, { live: false, speed });
          await setOnbAudio(concept, persona, lang, audio.base64);
          done++;
          console.log(`  [${done + skipped + failed}/${total}] \u2713 ${concept}/${persona}/${lang}`);
        } catch (err) {
          failed++;
          console.error(`  [${done + skipped + failed}/${total}] \u2717 ${concept}/${persona}/${lang}:`, err.message);
        }
      }
    }
  }
  console.log(`
Done. Generated: ${done}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=pregen-onb-voice.mjs.map
