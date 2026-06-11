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
  professional: "P1hTNpVDMG973fukK9V2",
  // Ate Ada — warm, wise, middle-aged, formal (fil)
  funny: "cvnP6nKXpiWGFASDWN3Y",
  mom: "gILcvhAz18uV9ARSsU4u",
  sarcastic: "RGymW84CSmfVugnA5tvA",
  marites: "XB0fDUnXU5powFXDhCwa",
  britney: "n6WaB3rOlZSC9y8yEPEz"
  // Use professional Filipino voice — Britney stays direct regardless of language
};
var PHILIPPINE_ENGLISH_VOICE_IDS = {
  professional: "P1hTNpVDMG973fukK9V2",
  // Ate Ada — warm, wise, middle-aged, formal (fil)
  funny: "cvnP6nKXpiWGFASDWN3Y",
  mom: "gILcvhAz18uV9ARSsU4u",
  sarcastic: "RGymW84CSmfVugnA5tvA",
  marites: "XB0fDUnXU5powFXDhCwa",
  britney: "Xb7hH8MSUJpSbSDYk0k2"
};
var PERSONA_SPEED = {
  professional: 0.92,
  funny: 0.92,
  sarcastic: 0.92,
  mom: 0.92,
  marites: 1.12,
  // perky, fast-talking gossip-friend energy
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
- Example: user asks "what's due this week?" and 4 bills are overdue \u2192 CORRECT: "Nothing new due this week. But you've got \u20B113,000 overdue \u2014 4 bills past due."
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

BILL EDITING CAPABILITIES:
When the user asks to update, change, edit, or modify an existing bill \u2014 its amount, paid status, partial payment, category, bill type, reminder days, business tag, house/property label, or auto-charge-to-card setting \u2014 find the bill in the BILLS context by its [id:XXX] prefix and emit ONE edit action tag.

Reply naturally in 1\u20132 sentences (your persona's voice, no markdown), then append the tag at the very end of your reply on the same line:

MARK AS FULLY PAID:
   <<ACTION:{"type":"mark_paid","id":"<exact-id-from-context>"}>>

RECORD A PAYMENT (partial or full \u2014 user says "I paid \u20B1X for/towards/to [bill]"):
   <<ACTION:{"type":"add_payment","id":"<exact-id-from-context>","amount":<number>}>>

UPDATE STATEMENT / BILL AMOUNT (new amount, new statement, revised charge):
   <<ACTION:{"type":"update_amount","id":"<exact-id-from-context>","amount":<number>}>>

UPDATE OTHER FIELDS (category, kind, reminder days, business flag, house/property label, auto-charge):
   <<ACTION:{"type":"update_bill","id":"<exact-id-from-context>","cat":"<optional>","kind":"<Fixed|Variable>","reminderDays":<number>,"isBusiness":<true|false>,"house":"<label>","chargedToCard":<true|false>}>>
   (only include the fields the user explicitly asked to change \u2014 omit all others)

Edit action rules:
- ALWAYS use the exact [id:XXX] value shown in the BILLS context \u2014 never invent, shorten, or modify an id
- If you cannot identify the exact bill (ambiguous name, no id in context, multiple matches), ask for clarification \u2014 do not guess
- "Mark as paid" \u2192 use mark_paid. "I paid \u20B1X" \u2192 use add_payment. "Change amount to \u20B1X" \u2192 use update_amount
- amount in all actions is a plain number (no currency symbol, no commas)
`.trim();

// src/lib/audioCache.ts
var BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
var REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
var _bucket = null;
async function getBucket() {
  if (!BUCKET_ID) return null;
  try {
    if (!_bucket) {
      const { Storage: StorageCls } = await import("@google-cloud/storage");
      const storage = new StorageCls({
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
function sampleLangKey(lang, countryCode) {
  const base = lang.startsWith("en") ? "en" : lang;
  return countryCode ? `${base}_${countryCode}` : base;
}
var SAMPLE_PREFIX = "persona-sample-v2";
async function setSampleAudio(persona, lang, audioBase64, countryCode) {
  const bucket = await getBucket();
  if (!bucket) return;
  try {
    const langSlot = sampleLangKey(lang, countryCode);
    const key = `${SAMPLE_PREFIX}/${persona}/${langSlot}.mp3`;
    const buf = Buffer.from(audioBase64, "base64");
    const file = bucket.file(key);
    await file.save(buf, {
      resumable: false,
      metadata: { contentType: "audio/mpeg" }
    });
    await file.makePublic().catch(() => {
    });
  } catch {
  }
}
async function hasSampleAudio(persona, lang, countryCode) {
  const bucket = await getBucket();
  if (!bucket) return false;
  try {
    const key = `${SAMPLE_PREFIX}/${persona}/${sampleLangKey(lang, countryCode)}.mp3`;
    const [exists] = await bucket.file(key).exists();
    return exists;
  } catch {
    return false;
  }
}

// scripts/pregen-persona-samples.ts
var ALL_PERSONAS = [
  "professional",
  "funny",
  "sarcastic",
  "mom",
  "marites",
  "britney"
];
var BASE_PERSONAS = [
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
var OTHER_LANG_TEXT = {
  es: {
    professional: "Soy Judith, tu asistente de fechas de vencimiento. Me encargo de que nunca te pille por sorpresa una mora.",
    funny: "\xA1Hola! Soy Judith \u2014 b\xE1sicamente tu amiga m\xE1s responsable con el dinero. De nada, por cierto.",
    sarcastic: "Judith aqu\xED. Te recuerdo tus facturas. Porque al parecer alguien tiene que hacerlo.",
    mom: "Hola, soy Judith. Voy a vigilar todas tus facturas. No te preocupes, lo tengo todo bajo control.",
    marites: "\xA1Dios m\xEDo, hola! \xA1Soy Judith! Literalmente s\xE9 todo sobre tus facturas \u2014 y tenemos que hablar."
  },
  pt: {
    professional: "Sou a Judith, sua assistente de datas de vencimento. Cuido para que voc\xEA nunca seja pega de surpresa por uma multa.",
    funny: "Oi! Sou a Judith \u2014 basicamente sua amiga mais respons\xE1vel com dinheiro. De nada, ali\xE1s.",
    sarcastic: "Judith aqui. Te lembro das suas contas. Porque aparentemente algu\xE9m tem que fazer isso.",
    mom: "Oi, sou a Judith. Vou cuidar de todas as suas contas. N\xE3o se preocupe, tenho tudo sob controle.",
    marites: "Meu Deus, oi! Sou a Judith! Literalmente sei tudo sobre suas contas \u2014 e a gente precisa conversar."
  },
  "pt-PT": {
    professional: "Sou a Judith, a tua assistente de datas de vencimento. Trato de que nunca sejas apanhada de surpresa por uma mora.",
    funny: "Ol\xE1! Sou a Judith \u2014 basicamente a tua amiga mais respons\xE1vel a n\xEDvel financeiro. De nada, por acaso.",
    sarcastic: "Judith aqui. Lembro-te das tuas faturas. Porque ao que parece algu\xE9m tem de o fazer.",
    mom: "Ol\xE1, sou a Judith. Vou vigiar todas as tuas faturas. N\xE3o te preocupes, tenho tudo sob controlo.",
    marites: "Meu Deus, ol\xE1! Sou a Judith! Literalmente sei tudo sobre as tuas faturas \u2014 e temos de falar."
  },
  fr: {
    professional: "Je suis Judith, votre assistante de dates d'\xE9ch\xE9ance. Je veille \xE0 ce que vous ne soyez jamais surpris par des p\xE9nalit\xE9s de retard.",
    funny: "Bonjour! Je suis Judith \u2014 en gros votre amie la plus responsable c\xF4t\xE9 finances. De rien, au passage.",
    sarcastic: "Judith ici. Je vous rappelle vos factures. Parce qu'apparemment quelqu'un doit le faire.",
    mom: "Bonjour, je suis Judith. Je vais surveiller toutes vos factures. Ne vous inqui\xE9tez pas, j'ai tout sous contr\xF4le.",
    marites: "Mon Dieu, bonjour! C'est Judith! Je sais litt\xE9ralement tout sur vos factures \u2014 et on doit vraiment parler."
  },
  de: {
    professional: "Ich bin Judith, Ihre F\xE4lligkeitsdaten-Assistentin. Ich sorge daf\xFCr, dass Sie nie von einem Zahlungsverzug \xFCberrascht werden.",
    funny: "Hi! Ich bin Judith \u2014 sozusagen Ihre finanziell verantwortungsvollste Freundin. Bitte sehr, \xFCbrigens.",
    sarcastic: "Judith hier. Ich erinnere Sie an Ihre Rechnungen. Weil das anscheinend jemand tun muss.",
    mom: "Hallo, ich bin Judith. Ich behalte all Ihre Rechnungen im Blick. Machen Sie sich keine Sorgen, ich habe alles unter Kontrolle.",
    marites: "Oh mein Gott, hallo! Ich bin Judith! Ich wei\xDF buchst\xE4blich alles \xFCber Ihre Rechnungen \u2014 und wir m\xFCssen reden."
  },
  it: {
    professional: "Sono Judith, la tua assistente per le scadenze di pagamento. Mi assicuro che tu non venga mai colta di sorpresa da una mora.",
    funny: "Ciao! Sono Judith \u2014 praticamente la tua amica pi\xF9 responsabile con i soldi. Prego, tra l'altro.",
    sarcastic: "Qui Judith. Ti ricordo le tue bollette. Perch\xE9 apparentemente qualcuno deve farlo.",
    mom: "Ciao, sono Judith. Terr\xF2 d'occhio tutte le tue bollette. Non preoccuparti, ho tutto sotto controllo.",
    marites: "Madonna, ciao! Sono Judith! Letteralmente so tutto delle tue bollette \u2014 e dobbiamo parlare."
  },
  nl: {
    professional: "Ik ben Judith, uw assistent voor vervaldatums. Ik zorg ervoor dat u nooit verrast wordt door een late betaling.",
    funny: "Hoi! Ik ben Judith \u2014 eigenlijk uw meest financieel verantwoordelijke vriendin. Graag gedaan, trouwens.",
    sarcastic: "Judith hier. Ik herinner u aan uw rekeningen. Omdat dat blijkbaar iemand moet doen.",
    mom: "Hoi, ik ben Judith. Ik houd al uw rekeningen in de gaten. Maak u geen zorgen, ik heb alles onder controle.",
    marites: "Oh mijn god, hoi! Ik ben Judith! Ik weet letterlijk alles over uw rekeningen \u2014 en we moeten praten."
  },
  pl: {
    professional: "Jestem Judith, twoj\u0105 asystentk\u0105 termin\xF3w p\u0142atno\u015Bci. Dbam o to, \u017Ceby\u015B nigdy nie by\u0142a zaskoczona op\u0142at\u0105 za sp\xF3\u017Anienie.",
    funny: "Cze\u015B\u0107! Jestem Judith \u2014 w zasadzie twoja najbardziej odpowiedzialna finansowo przyjaci\xF3\u0142ka. Prosz\u0119 bardzo, przy okazji.",
    sarcastic: "Judith tu. Przypominam ci o twoich rachunkach. Bo podobno kto\u015B musi to robi\u0107.",
    mom: "Cze\u015B\u0107, jestem Judith. B\u0119d\u0119 pilnowa\u0107 wszystkich twoich rachunk\xF3w. Nie martw si\u0119, mam wszystko pod kontrol\u0105.",
    marites: "O Bo\u017Ce, cze\u015B\u0107! Jestem Judith! Dos\u0142ownie wiem wszystko o twoich rachunkach \u2014 i musimy porozmawia\u0107."
  },
  sv: {
    professional: "Jag \xE4r Judith, din assistent f\xF6r f\xF6rfallodatum. Jag ser till att du aldrig \xF6verraskas av en f\xF6rseningsavgift.",
    funny: "Hej! Jag \xE4r Judith \u2014 i princip din mest ekonomiskt ansvarsfulla v\xE4n. Vars\xE5god, f\xF6rresten.",
    sarcastic: "Judith h\xE4r. Jag p\xE5minner dig om dina r\xE4kningar. F\xF6r tydligen m\xE5ste n\xE5gon g\xF6ra det.",
    mom: "Hej, jag \xE4r Judith. Jag h\xE5ller koll p\xE5 alla dina r\xE4kningar. Oroa dig inte, jag har allt under kontroll.",
    marites: "\xC5h vad kul, hej! Det \xE4r Judith! Jag vet bokstavligen allt om dina r\xE4kningar \u2014 och vi m\xE5ste prata."
  },
  da: {
    professional: "Jeg er Judith, din assistent for forfaldsdatoer. Jeg s\xF8rger for, at du aldrig overraskes af et gebyr for forsinket betaling.",
    funny: "Hej! Jeg er Judith \u2014 dybest set din mest \xF8konom-ansvarlige veninde. Selv tak, i \xF8vrigt.",
    sarcastic: "Judith her. Jeg minder dig om dine regninger. Fordi nogen \xE5benbart er n\xF8dt til det.",
    mom: "Hej, jeg er Judith. Jeg holder \xF8je med alle dine regninger. Bekymr dig ikke, jeg har styr p\xE5 det hele.",
    marites: "\xC5h gud, hej! Det er Judith! Jeg ved bogstaveligt talt alt om dine regninger \u2014 og vi er n\xF8dt til at tale."
  },
  no: {
    professional: "Jeg er Judith, din assistent for forfallsdatoer. Jeg s\xF8rger for at du aldri overraskes av et gebyr for forsinket betaling.",
    funny: "Hei! Jeg er Judith \u2014 i bunn og grunn din mest \xF8konomisk ansvarlige venn. V\xE6r s\xE5 god, forresten.",
    sarcastic: "Judith her. Jeg minner deg p\xE5 regningene dine. For tilsynelatende m\xE5 noen gj\xF8re det.",
    mom: "Hei, jeg er Judith. Jeg holder \xF8ye med alle regningene dine. Ikke bekymre deg, jeg har alt under kontroll.",
    marites: "\xC5 Gud, hei! Det er Judith! Jeg vet bokstavelig talt alt om regningene dine \u2014 og vi m\xE5 snakke."
  },
  fi: {
    professional: "Olen Judith, er\xE4p\xE4iv\xE4avustajasi. Huolehdin siit\xE4, ett\xE4 sinulle ei tule koskaan yll\xE4tyksen\xE4 my\xF6h\xE4stymismaksu.",
    funny: "Hei! Olen Judith \u2014 k\xE4yt\xE4nn\xF6ss\xE4 taloudellisin vastuullisin yst\xE4v\xE4si. Ole hyv\xE4, muuten.",
    sarcastic: "Judith t\xE4\xE4ll\xE4. Muistutan sinua laskuistasi. Koska ilmeisesti jonkun t\xE4ytyy tehd\xE4 se.",
    mom: "Hei, olen Judith. Pid\xE4n silm\xE4ll\xE4 kaikkia laskujasi. \xC4l\xE4 huoli, minulla on kaikki hallinnassa.",
    marites: "Voi Luoja, hei! Judith t\xE4\xE4ll\xE4! Tied\xE4n kirjaimellisesti kaiken laskuistasi \u2014 ja meid\xE4n t\xE4ytyy puhua."
  },
  cs: {
    professional: "Jsem Judith, va\u0161e asistentka pro term\xEDny splatnosti. Star\xE1m se o to, abyste nikdy nebyla p\u0159ekvapena poplatkem za pozdn\xED platbu.",
    funny: "Ahoj! Jsem Judith \u2014 v podstat\u011B va\u0161e nejfinan\u010Dn\u011B odpov\u011Bdn\u011Bj\u0161\xED kamar\xE1dka. Pros\xEDm, mimochodem.",
    sarcastic: "Judith tady. P\u0159ipom\xEDn\xE1m v\xE1m va\u0161e \xFA\u010Dty. Proto\u017Ee to zjevn\u011B mus\xED n\u011Bkdo d\u011Blat.",
    mom: "Ahoj, jsem Judith. Budu hl\xEDdat v\u0161echny va\u0161e \xFA\u010Dty. Nebojte se, m\xE1m v\u0161e pod kontrolou.",
    marites: "Bo\u017Ee, ahoj! Jsem Judith! Doslova v\xEDm v\u0161e o va\u0161ich \xFA\u010Dtech \u2014 a mus\xEDme si promluvit."
  },
  sk: {
    professional: "Som Judith, va\u0161a asistentka pre term\xEDny splatnosti. Star\xE1m sa o to, aby v\xE1s nikdy neprekvapil poplatok za oneskoren\xFA platbu.",
    funny: "Ahoj! Som Judith \u2014 v podstate va\u0161a najfinan\u010Dne zodpovednej\u0161ia kamar\xE1tka. Pros\xEDm, mimochodom.",
    sarcastic: "Judith tu. Pripom\xEDnam v\xE1m va\u0161e \xFA\u010Dty. Preto\u017Ee to zjavne mus\xED niekto robi\u0165.",
    mom: "Ahoj, som Judith. Budem str\xE1\u017Ei\u0165 v\u0161etky va\u0161e \xFA\u010Dty. Nebojte sa, m\xE1m v\u0161etko pod kontrolou.",
    marites: "Bo\u017Ee, ahoj! Som Judith! Doslova viem v\u0161etko o va\u0161ich \xFA\u010Dtoch \u2014 a mus\xEDme sa porozpr\xE1va\u0165."
  },
  ro: {
    professional: "Sunt Judith, asistenta ta pentru termenele de plat\u0103. M\u0103 asigur c\u0103 nu e\u0219ti niciodat\u0103 surprins\u0103 de o penalitate de \xEEnt\xE2rziere.",
    funny: "Bun\u0103! Sunt Judith \u2014 practic prietena ta cea mai responsabil\u0103 financiar. Cu pl\u0103cere, apropo.",
    sarcastic: "Judith aici. \xCE\u021Bi amintesc de facturile tale. Pentru c\u0103 aparent cineva trebuie s\u0103 o fac\u0103.",
    mom: "Bun\u0103, sunt Judith. Voi \u021Bine un ochi pe toate facturile tale. Nu te \xEEngrijora, am totul sub control.",
    marites: "Doamne, bun\u0103! Sunt Judith! \u0218tiu literalmente totul despre facturile tale \u2014 \u0219i trebuie s\u0103 vorbim."
  },
  bg: {
    professional: "\u0410\u0437 \u0441\u044A\u043C \u0414\u0436\u0443\u0434\u0438\u0442, \u0432\u0430\u0448\u0438\u044F\u0442 \u0430\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u0437\u0430 \u043F\u0430\u0434\u0435\u0436\u0438 \u043D\u0430 \u043F\u043B\u0430\u0449\u0430\u043D\u0435. \u0413\u0440\u0438\u0436\u0430 \u0441\u0435 \u0434\u0430 \u043D\u0435 \u0431\u044A\u0434\u0435\u0442\u0435 \u043D\u0438\u043A\u043E\u0433\u0430 \u0438\u0437\u043D\u0435\u043D\u0430\u0434\u0430\u043D\u0430 \u043E\u0442 \u0442\u0430\u043A\u0441\u0430 \u0437\u0430 \u0437\u0430\u043A\u044A\u0441\u043D\u0435\u043D\u0438\u0435.",
    funny: "\u0417\u0434\u0440\u0430\u0432\u0435\u0439! \u0410\u0437 \u0441\u044A\u043C \u0414\u0436\u0443\u0434\u0438\u0442 \u2014 \u043D\u0430 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0430 \u043D\u0430\u0439-\u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E \u043E\u0442\u0433\u043E\u0432\u043E\u0440\u043D\u0430\u0442\u0430 \u0442\u0438 \u043F\u0440\u0438\u044F\u0442\u0435\u043B\u043A\u0430. \u041C\u043E\u043B\u044F, \u043C\u0435\u0436\u0434\u0443 \u0434\u0440\u0443\u0433\u043E\u0442\u043E.",
    sarcastic: "\u0414\u0436\u0443\u0434\u0438\u0442 \u0442\u0443\u043A. \u041D\u0430\u043F\u043E\u043C\u043D\u044F\u043C \u0442\u0438 \u0437\u0430 \u0441\u043C\u0435\u0442\u043A\u0438\u0442\u0435 \u0442\u0438. \u0417\u0430\u0449\u043E\u0442\u043E \u043E\u0447\u0435\u0432\u0438\u0434\u043D\u043E \u043D\u044F\u043A\u043E\u0439 \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0433\u043E \u043F\u0440\u0430\u0432\u0438.",
    mom: "\u0417\u0434\u0440\u0430\u0432\u0435\u0439, \u0430\u0437 \u0441\u044A\u043C \u0414\u0436\u0443\u0434\u0438\u0442. \u0429\u0435 \u0441\u043B\u0435\u0434\u044F \u0432\u0441\u0438\u0447\u043A\u0438\u0442\u0435 \u0442\u0438 \u0441\u043C\u0435\u0442\u043A\u0438. \u041D\u0435 \u0441\u0435 \u043F\u0440\u0438\u0442\u0435\u0441\u043D\u044F\u0432\u0430\u0439, \u0438\u043C\u0430\u043C \u0432\u0441\u0438\u0447\u043A\u043E \u043F\u043E\u0434 \u043A\u043E\u043D\u0442\u0440\u043E\u043B.",
    marites: "\u0411\u043E\u0436\u0435 \u043C\u043E\u0439, \u0437\u0434\u0440\u0430\u0432\u0435\u0439! \u0410\u0437 \u0441\u044A\u043C \u0414\u0436\u0443\u0434\u0438\u0442! \u0411\u0443\u043A\u0432\u0430\u043B\u043D\u043E \u0437\u043D\u0430\u043C \u0432\u0441\u0438\u0447\u043A\u043E \u0437\u0430 \u0441\u043C\u0435\u0442\u043A\u0438\u0442\u0435 \u0442\u0438 \u2014 \u0438 \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u043C."
  },
  hr: {
    professional: "Ja sam Judith, va\u0161a asistentka za rokove pla\u0107anja. Brinem se da vas nikada ne iznenadi naknada za ka\u0161njenje.",
    funny: "Bok! Ja sam Judith \u2014 u biti va\u0161a najfinancijski odgovornija prijateljica. Nema na \u010Demu, usput.",
    sarcastic: "Judith ovdje. Podsje\u0107am vas na va\u0161e ra\u010Dune. Jer o\u010Dito netko to mora raditi.",
    mom: "Bok, ja sam Judith. Pazit \u0107u na sve va\u0161e ra\u010Dune. Ne brinite, sve imam pod kontrolom.",
    marites: "Bo\u017Ee moj, bok! Ja sam Judith! Doslovno znam sve o va\u0161im ra\u010Dunima \u2014 i moramo razgovarati."
  },
  el: {
    professional: "\u0395\u03AF\u03BC\u03B1\u03B9 \u03B7 \u03A4\u03B6\u03BF\u03CD\u03BD\u03C4\u03B9\u03B8, \u03B7 \u03B2\u03BF\u03B7\u03B8\u03CC\u03C2 \u03C3\u03BF\u03C5 \u03B3\u03B9\u03B1 \u03C4\u03B9\u03C2 \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B5\u03C2 \u03BB\u03AE\u03BE\u03B7\u03C2. \u03A6\u03C1\u03BF\u03BD\u03C4\u03AF\u03B6\u03C9 \u03BD\u03B1 \u03BC\u03B7\u03BD \u03C3\u03B5 \u03B5\u03BA\u03C0\u03BB\u03AE\u03C3\u03C3\u03B5\u03B9 \u03C0\u03BF\u03C4\u03AD \u03BC\u03B9\u03B1 \u03C7\u03C1\u03AD\u03C9\u03C3\u03B7 \u03BA\u03B1\u03B8\u03C5\u03C3\u03C4\u03AD\u03C1\u03B7\u03C3\u03B7\u03C2.",
    funny: "\u0393\u03B5\u03B9\u03B1! \u0395\u03AF\u03BC\u03B1\u03B9 \u03B7 \u03A4\u03B6\u03BF\u03CD\u03BD\u03C4\u03B9\u03B8 \u2014 \u03BF\u03C5\u03C3\u03B9\u03B1\u03C3\u03C4\u03B9\u03BA\u03AC \u03B7 \u03C0\u03B9\u03BF \u03BF\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03AC \u03C5\u03C0\u03B5\u03CD\u03B8\u03C5\u03BD\u03B7 \u03C6\u03AF\u03BB\u03B7 \u03C3\u03BF\u03C5. \u03A0\u03B1\u03C1\u03B1\u03BA\u03B1\u03BB\u03CE, \u03C0\u03B1\u03C1\u03B5\u03BC\u03C0\u03B9\u03C0\u03C4\u03CC\u03BD\u03C4\u03C9\u03C2.",
    sarcastic: "\u03A4\u03B6\u03BF\u03CD\u03BD\u03C4\u03B9\u03B8 \u03B5\u03B4\u03CE. \u03A3\u03BF\u03C5 \u03B8\u03C5\u03BC\u03AF\u03B6\u03C9 \u03C4\u03BF\u03C5\u03C2 \u03BB\u03BF\u03B3\u03B1\u03C1\u03B9\u03B1\u03C3\u03BC\u03BF\u03CD\u03C2 \u03C3\u03BF\u03C5. \u0395\u03C0\u03B5\u03B9\u03B4\u03AE \u03C0\u03C1\u03BF\u03C6\u03B1\u03BD\u03CE\u03C2 \u03BA\u03AC\u03C0\u03BF\u03B9\u03BF\u03C2 \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C4\u03BF \u03BA\u03AC\u03BD\u03B5\u03B9.",
    mom: "\u0393\u03B5\u03B9\u03B1, \u03B5\u03AF\u03BC\u03B1\u03B9 \u03B7 \u03A4\u03B6\u03BF\u03CD\u03BD\u03C4\u03B9\u03B8. \u0398\u03B1 \u03C0\u03B1\u03C1\u03B1\u03BA\u03BF\u03BB\u03BF\u03C5\u03B8\u03CE \u03CC\u03BB\u03BF\u03C5\u03C2 \u03C4\u03BF\u03C5\u03C2 \u03BB\u03BF\u03B3\u03B1\u03C1\u03B9\u03B1\u03C3\u03BC\u03BF\u03CD\u03C2 \u03C3\u03BF\u03C5. \u039C\u03B7\u03BD \u03B1\u03BD\u03B7\u03C3\u03C5\u03C7\u03B5\u03AF\u03C2, \u03C4\u03B1 \u03AD\u03C7\u03C9 \u03CC\u03BB\u03B1 \u03C5\u03C0\u03CC \u03AD\u03BB\u03B5\u03B3\u03C7\u03BF.",
    marites: "\u0398\u03B5\u03AD \u03BC\u03BF\u03C5, \u03B3\u03B5\u03B9\u03B1! \u0395\u03AF\u03BC\u03B1\u03B9 \u03B7 \u03A4\u03B6\u03BF\u03CD\u03BD\u03C4\u03B9\u03B8! \u039E\u03AD\u03C1\u03C9 \u03BA\u03C5\u03C1\u03B9\u03BF\u03BB\u03B5\u03BA\u03C4\u03B9\u03BA\u03AC \u03C4\u03B1 \u03C0\u03AC\u03BD\u03C4\u03B1 \u03B3\u03B9\u03B1 \u03C4\u03BF\u03C5\u03C2 \u03BB\u03BF\u03B3\u03B1\u03C1\u03B9\u03B1\u03C3\u03BC\u03BF\u03CD\u03C2 \u03C3\u03BF\u03C5 \u2014 \u03BA\u03B1\u03B9 \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03BC\u03B9\u03BB\u03AE\u03C3\u03BF\u03C5\u03BC\u03B5."
  },
  hu: {
    professional: "Judith vagyok, a fizet\xE9si hat\xE1rid\u0151-asszisztensed. Gondoskodom arr\xF3l, hogy soha ne lepjen meg k\xE9sedelmi d\xEDj.",
    funny: "Szia! Judith vagyok \u2014 l\xE9nyeg\xE9ben a legjobban p\xE9nz\xFCgyileg felel\u0151s bar\xE1tod. Sz\xEDvesen, egy\xE9bk\xE9nt.",
    sarcastic: "Judith itt. Eml\xE9keztetlek a sz\xE1ml\xE1idra. Mert nyilv\xE1n valakinek meg kell tennie.",
    mom: "Szia, Judith vagyok. Szemmel tartom az \xF6sszes sz\xE1ml\xE1dat. Ne agg\xF3dj, mindent k\xE9zben tartok.",
    marites: "Istenem, szia! Judith vagyok! Sz\xF3 szerint mindent tudok a sz\xE1ml\xE1idr\xF3l \u2014 \xE9s besz\xE9ln\xFCnk kell."
  },
  uk: {
    professional: "\u042F \u0414\u0436\u0443\u0434\u0456\u0442, \u0432\u0430\u0448 \u043F\u043E\u043C\u0456\u0447\u043D\u0438\u043A \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432 \u043F\u043B\u0430\u0442\u0435\u0436\u0456\u0432. \u0421\u0442\u0435\u0436\u0443 \u0437\u0430 \u0442\u0438\u043C, \u0449\u043E\u0431 \u0432\u0430\u0441 \u043D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u0437\u0430\u0441\u0442\u0430\u0432 \u0437\u043D\u0435\u043D\u0430\u0446\u044C\u043A\u0430 \u0448\u0442\u0440\u0430\u0444 \u0437\u0430 \u043F\u0440\u043E\u0441\u0442\u0440\u043E\u0447\u0435\u043D\u043D\u044F.",
    funny: "\u041F\u0440\u0438\u0432\u0456\u0442! \u042F \u0414\u0436\u0443\u0434\u0456\u0442 \u2014 \u043F\u043E \u0441\u0443\u0442\u0456 \u0432\u0430\u0448\u0430 \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448 \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0430 \u043F\u043E\u0434\u0440\u0443\u0433\u0430. \u0411\u0443\u0434\u044C \u043B\u0430\u0441\u043A\u0430, \u0434\u043E \u0440\u0435\u0447\u0456.",
    sarcastic: "\u0414\u0436\u0443\u0434\u0456\u0442 \u0442\u0443\u0442. \u041D\u0430\u0433\u0430\u0434\u0443\u044E \u0432\u0430\u043C \u043F\u0440\u043E \u0432\u0430\u0448\u0456 \u0440\u0430\u0445\u0443\u043D\u043A\u0438. \u0411\u043E \u043E\u0447\u0435\u0432\u0438\u0434\u043D\u043E \u0445\u0442\u043E\u0441\u044C \u0446\u0435 \u043C\u0430\u0454 \u0440\u043E\u0431\u0438\u0442\u0438.",
    mom: "\u041F\u0440\u0438\u0432\u0456\u0442, \u044F \u0414\u0436\u0443\u0434\u0456\u0442. \u0411\u0443\u0434\u0443 \u0441\u0442\u0435\u0436\u0438\u0442\u0438 \u0437\u0430 \u0432\u0441\u0456\u043C\u0430 \u0432\u0430\u0448\u0438\u043C\u0438 \u0440\u0430\u0445\u0443\u043D\u043A\u0430\u043C\u0438. \u041D\u0435 \u0445\u0432\u0438\u043B\u044E\u0439\u0442\u0435\u0441\u044F, \u0443 \u043C\u0435\u043D\u0435 \u0432\u0441\u0435 \u043F\u0456\u0434 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0435\u043C.",
    marites: "\u0411\u043E\u0436\u0435 \u043C\u0456\u0439, \u043F\u0440\u0438\u0432\u0456\u0442! \u042F \u0414\u0436\u0443\u0434\u0456\u0442! \u0411\u0443\u043A\u0432\u0430\u043B\u044C\u043D\u043E \u0437\u043D\u0430\u044E \u0432\u0441\u0435 \u043F\u0440\u043E \u0432\u0430\u0448\u0456 \u0440\u0430\u0445\u0443\u043D\u043A\u0438 \u2014 \u0456 \u043D\u0430\u043C \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u0438."
  },
  ru: {
    professional: "\u042F \u0414\u0436\u0443\u0434\u0438\u0442, \u0432\u0430\u0448 \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u043F\u043E \u0441\u0440\u043E\u043A\u0430\u043C \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439. \u0421\u043B\u0435\u0436\u0443 \u0437\u0430 \u0442\u0435\u043C, \u0447\u0442\u043E\u0431\u044B \u0432\u0430\u0441 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0437\u0430\u0441\u0442\u0430\u043B\u0438 \u0432\u0440\u0430\u0441\u043F\u043B\u043E\u0445 \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0435 \u043F\u043B\u0430\u0442\u0435\u0436\u0438.",
    funny: "\u041F\u0440\u0438\u0432\u0435\u0442! \u042F \u0414\u0436\u0443\u0434\u0438\u0442 \u2014 \u043F\u043E \u0441\u0443\u0442\u0438 \u0432\u0430\u0448\u0430 \u0441\u0430\u043C\u0430\u044F \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F \u043F\u043E\u0434\u0440\u0443\u0433\u0430. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u043A\u0441\u0442\u0430\u0442\u0438.",
    sarcastic: "\u0414\u0436\u0443\u0434\u0438\u0442 \u0437\u0434\u0435\u0441\u044C. \u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u044E \u0432\u0430\u043C \u043E \u0432\u0430\u0448\u0438\u0445 \u0441\u0447\u0435\u0442\u0430\u0445. \u041F\u043E\u0442\u043E\u043C\u0443 \u0447\u0442\u043E \u043E\u0447\u0435\u0432\u0438\u0434\u043D\u043E \u043A\u0442\u043E-\u0442\u043E \u0434\u043E\u043B\u0436\u0435\u043D \u044D\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C.",
    mom: "\u041F\u0440\u0438\u0432\u0435\u0442, \u044F \u0414\u0436\u0443\u0434\u0438\u0442. \u0411\u0443\u0434\u0443 \u0441\u043B\u0435\u0434\u0438\u0442\u044C \u0437\u0430 \u0432\u0441\u0435\u043C\u0438 \u0432\u0430\u0448\u0438\u043C\u0438 \u0441\u0447\u0435\u0442\u0430\u043C\u0438. \u041D\u0435 \u0431\u0435\u0441\u043F\u043E\u043A\u043E\u0439\u0442\u0435\u0441\u044C, \u0443 \u043C\u0435\u043D\u044F \u0432\u0441\u0451 \u043F\u043E\u0434 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0435\u043C.",
    marites: "\u0411\u043E\u0436\u0435 \u043C\u043E\u0439, \u043F\u0440\u0438\u0432\u0435\u0442! \u042F \u0414\u0436\u0443\u0434\u0438\u0442! \u0411\u0443\u043A\u0432\u0430\u043B\u044C\u043D\u043E \u0437\u043D\u0430\u044E \u0432\u0441\u0451 \u043E \u0432\u0430\u0448\u0438\u0445 \u0441\u0447\u0435\u0442\u0430\u0445 \u2014 \u0438 \u043D\u0430\u043C \u043D\u0443\u0436\u043D\u043E \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C."
  },
  tr: {
    professional: "Ben Judith, vade tarihi asistan\u0131n\u0131m. Asla ge\xE7 \xF6deme \xFCcreti s\xFCrpriziyle kar\u015F\u0131la\u015Fmaman\u0131z\u0131 sa\u011Fl\u0131yorum.",
    funny: "Merhaba! Ben Judith \u2014 temelde en mali sorumlu arkada\u015F\u0131n\u0131z. Rica ederim, bu arada.",
    sarcastic: "Judith burada. Faturalar\u0131n\u0131z\u0131 hat\u0131rlat\u0131yorum. \xC7\xFCnk\xFC bunu birinin yapmas\u0131 gerekiyor.",
    mom: "Merhaba, ben Judith. T\xFCm faturalar\u0131n\u0131za g\xF6z kulak olaca\u011F\u0131m. Merak etmeyin, her \u015Fey kontrol alt\u0131nda.",
    marites: "Tanr\u0131m, merhaba! Ben Judith! Faturalar\u0131n\u0131z hakk\u0131nda kelimenin tam anlam\u0131yla her \u015Feyi biliyorum \u2014 ve konu\u015Fmam\u0131z gerek."
  },
  ar: {
    professional: "\u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u0623\u062D\u0631\u0635 \u0639\u0644\u0649 \u0623\u0644\u0627 \u062A\u064F\u0641\u0627\u062C\u0626\u0643 \u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0623\u0628\u062F\u0627\u064B.",
    funny: "\u0645\u0631\u062D\u0628\u0627\u064B! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B \u2014 \u0628\u0627\u0644\u0623\u0633\u0627\u0633 \u0635\u062F\u064A\u0642\u062A\u0643 \u0627\u0644\u0623\u0643\u062B\u0631 \u0645\u0633\u0624\u0648\u0644\u064A\u0629 \u0645\u0627\u0644\u064A\u0627\u064B. \u0639\u0641\u0648\u0627\u064B\u060C \u0628\u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629.",
    sarcastic: "\u062C\u0648\u062F\u064A\u062B \u0647\u0646\u0627. \u0623\u0630\u0643\u0651\u0631\u0643 \u0628\u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0644\u0623\u0646 \u0623\u062D\u062F\u0627\u064B \u0645\u0627 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0641\u0639\u0644 \u0630\u0644\u0643.",
    mom: "\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B. \u0633\u0623\u062A\u0627\u0628\u0639 \u062C\u0645\u064A\u0639 \u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0644\u0627 \u062A\u0642\u0644\u0642\u064A\u060C \u0623\u0646\u0627 \u0623\u062A\u062D\u0643\u0645 \u0641\u064A \u0643\u0644 \u0634\u064A\u0621.",
    marites: "\u064A\u0627 \u0625\u0644\u0647\u064A\u060C \u0645\u0631\u062D\u0628\u0627\u064B! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B! \u0623\u0639\u0631\u0641 \u062D\u0631\u0641\u064A\u0627\u064B \u0643\u0644 \u0634\u064A\u0621 \u0639\u0646 \u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u2014 \u0648\u0639\u0644\u064A\u0646\u0627 \u0623\u0646 \u0646\u062A\u062D\u062F\u062B."
  },
  arz: {
    professional: "\u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0628\u062A\u0627\u0639\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u0628\u062A\u0623\u0643\u062F \u0625\u0646\u0643 \u0645\u062A\u062A\u0641\u0627\u062C\u0626\u064A\u0634 \u0628\u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0623\u0628\u062F\u0627\u064B.",
    funny: "\u0623\u0647\u0644\u0627\u064B! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B \u2014 \u0623\u0633\u0627\u0633\u0627\u064B \u0635\u0627\u062D\u0628\u062A\u0643 \u0627\u0644\u0623\u0643\u062B\u0631 \u0645\u0633\u0624\u0648\u0644\u064A\u0629 \u0645\u0627\u0644\u064A\u0627\u064B. \u0639\u0644\u0649 \u0625\u064A\u0647\u060C \u0628\u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629.",
    sarcastic: "\u062C\u0648\u062F\u064A\u062B \u0647\u0646\u0627. \u0628\u0641\u0643\u0651\u0631\u0643 \u0628\u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0644\u0623\u0646 \u062D\u062F \u0644\u0627\u0632\u0645 \u064A\u0639\u0645\u0644 \u0643\u062F\u0647.",
    mom: "\u0623\u0647\u0644\u0627\u064B\u060C \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B. \u0647\u062A\u0627\u0628\u0639 \u0643\u0644 \u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0645\u062A\u0642\u0644\u0642\u064A\u0634\u060C \u0623\u0646\u0627 \u0645\u0633\u064A\u0637\u0631\u0629 \u0639\u0644\u0649 \u0643\u0644 \u062D\u0627\u062C\u0629.",
    marites: "\u064A\u0627 \u0633\u0644\u0627\u0645\u060C \u0623\u0647\u0644\u0627\u064B! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B! \u0628\u0639\u0631\u0641 \u062D\u0631\u0641\u064A\u0627\u064B \u0643\u0644 \u062D\u0627\u062C\u0629 \u0639\u0646 \u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u2014 \u0648\u0644\u0627\u0632\u0645 \u0646\u062A\u0643\u0644\u0645."
  },
  apc: {
    professional: "\u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u0628\u062D\u0631\u0635 \u0625\u0646\u0643 \u0645\u0627 \u062A\u062A\u0641\u0627\u062C\u0626\u064A \u0628\u063A\u0631\u0627\u0645\u0627\u062A \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0623\u0628\u062F\u0627\u064B.",
    funny: "\u0645\u0631\u062D\u0628\u0627! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B \u2014 \u0628\u0627\u0644\u0623\u0633\u0627\u0633 \u0631\u0641\u064A\u0642\u062A\u0643 \u0627\u0644\u0623\u0643\u062B\u0631 \u0645\u0633\u0624\u0648\u0644\u064A\u0629 \u0645\u0627\u0644\u064A\u0627\u064B. \u0639\u0641\u0648\u0627\u064B\u060C \u0628\u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629.",
    sarcastic: "\u062C\u0648\u062F\u064A\u062B \u0647\u0648\u0646. \u0639\u0645 \u0628\u0630\u0643\u0651\u0631\u0643 \u0628\u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0644\u0623\u0646\u0647 \u0648\u0627\u0636\u062D \u0641\u064A \u062D\u062F\u0627 \u0644\u0627\u0632\u0645 \u064A\u0639\u0645\u0644 \u0647\u064A\u0643.",
    mom: "\u0645\u0631\u062D\u0628\u0627\u060C \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B. \u0631\u062D \u062A\u0627\u0628\u0639 \u0643\u0644 \u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0645\u0627 \u062A\u0642\u0644\u0642\u064A\u060C \u0639\u0646\u062F\u064A \u0643\u0644 \u0634\u064A \u062A\u062D\u062A \u0627\u0644\u0633\u064A\u0637\u0631\u0629.",
    marites: "\u064A\u0627 \u0625\u0644\u0647\u064A\u060C \u0645\u0631\u062D\u0628\u0627! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B! \u0628\u0639\u0631\u0641 \u062D\u0631\u0641\u064A\u0627\u064B \u0643\u0644 \u0634\u064A \u0639\u0646 \u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u2014 \u0648\u0644\u0627\u0632\u0645 \u0646\u062D\u0643\u064A."
  },
  afb: {
    professional: "\u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B\u060C \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642. \u0623\u0636\u0645\u0646 \u0645\u0627 \u062A\u062A\u0641\u0627\u062C\u0626\u064A\u0646 \u0645\u0646 \u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0623\u0628\u062F\u0627\u064B.",
    funny: "\u0647\u0644\u0627! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B \u2014 \u0628\u0627\u0644\u0623\u0633\u0627\u0633 \u0635\u062F\u064A\u0642\u062A\u0643 \u0627\u0644\u0623\u0643\u062B\u0631 \u0645\u0633\u0624\u0648\u0644\u064A\u0629 \u0645\u0627\u0644\u064A\u0627\u064B. \u0639\u0641\u0648\u0627\u064B\u060C \u0628\u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629.",
    sarcastic: "\u062C\u0648\u062F\u064A\u062B \u0647\u0646\u064A. \u0623\u0630\u0643\u0651\u0631\u0643 \u0628\u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0644\u0623\u0646\u0647 \u0648\u0627\u0636\u062D \u0641\u064A \u0623\u062D\u062F \u0644\u0627\u0632\u0645 \u064A\u0633\u0648\u064A \u0647\u0630\u0627.",
    mom: "\u0647\u0644\u0627\u060C \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B. \u0631\u0627\u062D \u0623\u062A\u0627\u0628\u0639 \u062C\u0645\u064A\u0639 \u0641\u0648\u0627\u062A\u064A\u0631\u0643. \u0644\u0627 \u062A\u0642\u0644\u0642\u064A\u0646\u060C \u0643\u0644 \u0634\u064A \u062A\u062D\u062A \u0627\u0644\u0633\u064A\u0637\u0631\u0629.",
    marites: "\u064A\u0627 \u0627\u0644\u0644\u0647\u060C \u0647\u0644\u0627! \u0623\u0646\u0627 \u062C\u0648\u062F\u064A\u062B! \u0623\u0639\u0631\u0641 \u062D\u0631\u0641\u064A\u0627\u064B \u0643\u0644 \u0634\u064A \u0639\u0646 \u0641\u0648\u0627\u062A\u064A\u0631\u0643 \u2014 \u0648\u0644\u0627\u0632\u0645 \u0646\u062A\u0643\u0644\u0645."
  },
  hi: {
    professional: "\u092E\u0948\u0902 \u091C\u0942\u0921\u093F\u0925 \u0939\u0942\u0901, \u0906\u092A\u0915\u0940 \u0926\u0947\u092F \u0924\u093F\u0925\u093F \u0938\u0939\u093E\u092F\u0915\u0964 \u092E\u0948\u0902 \u0938\u0941\u0928\u093F\u0936\u094D\u091A\u093F\u0924 \u0915\u0930\u0924\u0940 \u0939\u0942\u0901 \u0915\u093F \u0906\u092A \u0915\u092D\u0940 \u092D\u0940 \u0935\u093F\u0932\u0902\u092C \u0936\u0941\u0932\u094D\u0915 \u0938\u0947 \u091A\u094C\u0902\u0915\u0947 \u0928\u0939\u0940\u0902\u0964",
    funny: "\u0928\u092E\u0938\u094D\u0924\u0947! \u092E\u0948\u0902 \u091C\u0942\u0921\u093F\u0925 \u0939\u0942\u0901 \u2014 basically \u0906\u092A\u0915\u0940 \u0938\u092C\u0938\u0947 financially \u091C\u093F\u092E\u094D\u092E\u0947\u0926\u093E\u0930 \u0926\u094B\u0938\u094D\u0924\u0964 \u0935\u0948\u0938\u0947, \u0936\u0941\u0915\u094D\u0930\u093F\u092F\u093E\u0964",
    sarcastic: "\u091C\u0942\u0921\u093F\u0925 \u092F\u0939\u093E\u0901\u0964 \u0906\u092A\u0915\u094B \u092C\u093F\u0932\u094B\u0902 \u0915\u0940 \u092F\u093E\u0926 \u0926\u093F\u0932\u093E \u0930\u0939\u0940 \u0939\u0942\u0901\u0964 \u0915\u094D\u092F\u094B\u0902\u0915\u093F \u091C\u093E\u0939\u093F\u0930 \u0939\u0948 \u0915\u094B\u0908 \u0924\u094B \u092F\u0939 \u0915\u0930\u0947\u0917\u093E\u0964",
    mom: "\u0928\u092E\u0938\u094D\u0924\u0947, \u092E\u0948\u0902 \u091C\u0942\u0921\u093F\u0925 \u0939\u0942\u0901\u0964 \u092E\u0948\u0902 \u0906\u092A\u0915\u0947 \u0938\u092D\u0940 \u092C\u093F\u0932\u094B\u0902 \u092A\u0930 \u0928\u091C\u093C\u0930 \u0930\u0916\u0942\u0901\u0917\u0940\u0964 \u091A\u093F\u0902\u0924\u093E \u092E\u0924 \u0915\u0930\u094B, \u0938\u092C \u0915\u0941\u091B \u092E\u0947\u0930\u0947 \u0939\u093E\u0925 \u092E\u0947\u0902 \u0939\u0948\u0964",
    marites: "\u092D\u0917\u0935\u093E\u0928, \u0928\u092E\u0938\u094D\u0924\u0947! \u092E\u0948\u0902 \u091C\u0942\u0921\u093F\u0925 \u0939\u0942\u0901! \u092E\u0941\u091D\u0947 \u0906\u092A\u0915\u0947 \u0938\u092D\u0940 \u092C\u093F\u0932\u094B\u0902 \u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902 \u0938\u091A \u092E\u0947\u0902 \u0938\u092C \u0915\u0941\u091B \u092A\u0924\u093E \u0939\u0948 \u2014 \u0914\u0930 \u0939\u092E\u0947\u0902 \u092C\u093E\u0924 \u0915\u0930\u0928\u0940 \u0939\u094B\u0917\u0940\u0964"
  },
  ta: {
    professional: "\u0BA8\u0BBE\u0BA9\u0BCD \u0B9C\u0BC2\u0B9F\u0BBF\u0BA4\u0BCD, \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BA4\u0BB5\u0BA3\u0BC8 \u0BA4\u0BC7\u0BA4\u0BBF \u0B89\u0BA4\u0BB5\u0BBF\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD. \u0BA8\u0BC0\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BA4\u0BBE\u0BAE\u0BA4\u0B95\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0BA4\u0BCD\u0BA4\u0BBE\u0BB2\u0BCD \u0B92\u0BB0\u0BC1\u0BAA\u0BCB\u0BA4\u0BC1\u0BAE\u0BCD \u0B85\u0BA4\u0BBF\u0BB0\u0BCD\u0B9A\u0BCD\u0B9A\u0BBF\u0BAF\u0B9F\u0BC8\u0BAF\u0BBE\u0BAE\u0BB2\u0BCD \u0BAA\u0BBE\u0BB0\u0BCD\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BCD\u0B95\u0BCA\u0BB3\u0BCD\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD.",
    funny: "\u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD! \u0BA8\u0BBE\u0BA9\u0BCD \u0B9C\u0BC2\u0B9F\u0BBF\u0BA4\u0BCD \u2014 basically \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BAE\u0BBF\u0B95\u0BB5\u0BC1\u0BAE\u0BCD \u0BA8\u0BBF\u0BA4\u0BBF \u0BAA\u0BCA\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BBE\u0BA9 \u0BA4\u0BCB\u0BB4\u0BBF. \u0BA8\u0BA9\u0BCD\u0BB1\u0BBF \u0B9A\u0BCA\u0BB2\u0BCD\u0BB2 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BBE\u0BAE\u0BCD!",
    sarcastic: "\u0B9C\u0BC2\u0B9F\u0BBF\u0BA4\u0BCD \u0B87\u0B99\u0BCD\u0B95\u0BC7. \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0B99\u0BCD\u0B95\u0BB3\u0BC8 \u0BA8\u0BBF\u0BA9\u0BC8\u0BB5\u0BC2\u0B9F\u0BCD\u0B9F\u0BC1\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD. \u0B8F\u0BA9\u0BC6\u0BA9\u0BBF\u0BB2\u0BCD \u0BAF\u0BBE\u0BB0\u0BBE\u0BB5\u0BA4\u0BC1 \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD.",
    mom: "\u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD, \u0BA8\u0BBE\u0BA9\u0BCD \u0B9C\u0BC2\u0B9F\u0BBF\u0BA4\u0BCD. \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B85\u0BA9\u0BC8\u0BA4\u0BCD\u0BA4\u0BC1 \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0B99\u0BCD\u0B95\u0BB3\u0BC8\u0BAF\u0BC1\u0BAE\u0BCD \u0B95\u0BB5\u0BA9\u0BBF\u0BAA\u0BCD\u0BAA\u0BC7\u0BA9\u0BCD. \u0B95\u0BB5\u0BB2\u0BC8\u0BAA\u0BCD\u0BAA\u0B9F\u0BBE\u0BA4\u0BC0\u0BB0\u0BCD\u0B95\u0BB3\u0BCD, \u0B8E\u0BB2\u0BCD\u0BB2\u0BBE\u0BAE\u0BCD \u0B8E\u0BA9\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BC1\u0BAA\u0BCD\u0BAA\u0BBE\u0B9F\u0BCD\u0B9F\u0BBF\u0BB2\u0BCD \u0B89\u0BB3\u0BCD\u0BB3\u0BA4\u0BC1.",
    marites: "\u0B90\u0BAF\u0BCB, \u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD! \u0BA8\u0BBE\u0BA9\u0BCD \u0B9C\u0BC2\u0B9F\u0BBF\u0BA4\u0BCD! \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B95\u0B9F\u0BCD\u0B9F\u0BA3\u0B99\u0BCD\u0B95\u0BB3\u0BC8\u0BAA\u0BCD \u0BAA\u0BB1\u0BCD\u0BB1\u0BBF \u0B8E\u0BB2\u0BCD\u0BB2\u0BBE\u0BAE\u0BCD \u0BA4\u0BC6\u0BB0\u0BBF\u0BAF\u0BC1\u0BAE\u0BCD \u2014 \u0BA8\u0BBE\u0BAE\u0BCD \u0BAA\u0BC7\u0B9A\u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD."
  },
  ja: {
    professional: "\u30B8\u30E5\u30C7\u30A3\u30B9\u3067\u3059\u3002\u304A\u652F\u6255\u3044\u671F\u65E5\u306E\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3068\u3057\u3066\u3001\u5EF6\u6EDE\u6599\u91D1\u3067\u9A5A\u304B\u3055\u308C\u308B\u3053\u3068\u304C\u306A\u3044\u3088\u3046\u7BA1\u7406\u3057\u307E\u3059\u3002",
    funny: "\u3053\u3093\u306B\u3061\u306F\uFF01\u30B8\u30E5\u30C7\u30A3\u30B9\u3067\u3059 \u2014 \u57FA\u672C\u7684\u306B\u3001\u3042\u306A\u305F\u306E\u4E00\u756A\u304A\u91D1\u306B\u8CAC\u4EFB\u611F\u306E\u3042\u308B\u53CB\u9054\u3067\u3059\u3002\u3069\u3046\u3044\u305F\u3057\u307E\u3057\u3066\u3001\u3061\u306A\u307F\u306B\u3002",
    sarcastic: "\u30B8\u30E5\u30C7\u30A3\u30B9\u3067\u3059\u3002\u8ACB\u6C42\u66F8\u3092\u601D\u3044\u51FA\u3055\u305B\u307E\u3059\u3002\u8AB0\u304B\u304C\u3084\u3089\u306A\u3044\u3068\u3044\u3051\u306A\u3044\u306E\u3067\u3002",
    mom: "\u3053\u3093\u306B\u3061\u306F\u3001\u30B8\u30E5\u30C7\u30A3\u30B9\u3067\u3059\u3002\u3042\u306A\u305F\u306E\u8ACB\u6C42\u66F8\u3092\u3059\u3079\u3066\u898B\u5B88\u308A\u307E\u3059\u3002\u5FC3\u914D\u3057\u306A\u3044\u3067\u3001\u5168\u90E8\u4EFB\u305B\u3066\u304F\u3060\u3055\u3044\u3002",
    marites: "\u3048\u30FC\u3001\u3053\u3093\u306B\u3061\u306F\uFF01\u30B8\u30E5\u30C7\u30A3\u30B9\u3067\u3059\uFF01\u3042\u306A\u305F\u306E\u8ACB\u6C42\u66F8\u306B\u3064\u3044\u3066\u672C\u5F53\u306B\u5168\u90E8\u77E5\u3063\u3066\u307E\u3059\u3088 \u2014 \u3061\u3087\u3063\u3068\u304A\u8A71\u3057\u307E\u3057\u3087\u3046\uFF01"
  },
  ko: {
    professional: "\uC800\uB294 \uC8FC\uB514\uC2A4\uC608\uC694, \uB0A9\uBD80\uC77C \uB3C4\uC6B0\uBBF8\uC785\uB2C8\uB2E4. \uC5F0\uCCB4\uB8CC\uC5D0 \uC808\uB300 \uB180\uB77C\uC9C0 \uC54A\uB3C4\uB85D \uCC59\uACA8\uB4DC\uB9B4\uAC8C\uC694.",
    funny: "\uC548\uB155\uD558\uC138\uC694! \uC800\uB294 \uC8FC\uB514\uC2A4 \u2014 \uAE30\uBCF8\uC801\uC73C\uB85C \uB2F9\uC2E0\uC758 \uAC00\uC7A5 \uC7AC\uC815\uC801\uC73C\uB85C \uCC45\uC784\uAC10 \uC788\uB294 \uCE5C\uAD6C\uC608\uC694. \uCC9C\uB9CC\uC5D0\uC694, \uCC38\uACE0\uB85C.",
    sarcastic: "\uC8FC\uB514\uC2A4\uC785\uB2C8\uB2E4. \uCCAD\uAD6C\uC11C\uB97C \uC54C\uB824\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4. \uB204\uAD70\uAC00\uB294 \uD574\uC57C \uD558\uB2C8\uAE4C\uC694.",
    mom: "\uC548\uB155\uD558\uC138\uC694, \uC8FC\uB514\uC2A4\uC608\uC694. \uBAA8\uB4E0 \uCCAD\uAD6C\uC11C\uB97C \uB2E4 \uCC59\uACA8\uB4DC\uB9B4\uAC8C\uC694. \uAC71\uC815 \uB9C8\uC138\uC694, \uB2E4 \uC81C\uAC00 \uC54C\uC544\uC11C \uD560\uAC8C\uC694.",
    marites: "\uC5B4\uBA38, \uC548\uB155\uD558\uC138\uC694! \uC8FC\uB514\uC2A4\uC608\uC694! \uCCAD\uAD6C\uC11C \uAD00\uB828\uD574\uC11C \uC9C4\uC9DC \uB2E4 \uC54C\uACE0 \uC788\uC5B4\uC694 \u2014 \uC6B0\uB9AC \uC598\uAE30 \uC880 \uD574\uC57C \uD574\uC694."
  },
  zh: {
    professional: "\u6211\u662F\u8331\u8FEA\u4E1D\uFF0C\u60A8\u7684\u8D26\u5355\u5230\u671F\u65E5\u52A9\u624B\u3002\u6211\u4F1A\u786E\u4FDD\u60A8\u6C38\u8FDC\u4E0D\u4F1A\u88AB\u6EDE\u7EB3\u91D1\u6240\u60CA\u5230\u3002",
    funny: "\u4F60\u597D\uFF01\u6211\u662F\u8331\u8FEA\u4E1D \u2014 \u57FA\u672C\u4E0A\u662F\u60A8\u6700\u6709\u8D22\u52A1\u8D23\u4EFB\u611F\u7684\u670B\u53CB\u3002\u4E0D\u5BA2\u6C14\uFF0C\u987A\u4FBF\u4E00\u63D0\u3002",
    sarcastic: "\u8331\u8FEA\u4E1D\u5728\u8FD9\u91CC\u3002\u63D0\u9192\u60A8\u7F34\u8D39\u3002\u56E0\u4E3A\u663E\u7136\u5F97\u6709\u4EBA\u6765\u505A\u8FD9\u4EF6\u4E8B\u3002",
    mom: "\u4F60\u597D\uFF0C\u6211\u662F\u8331\u8FEA\u4E1D\u3002\u6211\u4F1A\u5E2E\u60A8\u76EF\u7740\u6240\u6709\u8D26\u5355\u3002\u522B\u62C5\u5FC3\uFF0C\u4E00\u5207\u5C3D\u5728\u638C\u63E1\u4E4B\u4E2D\u3002",
    marites: "\u5929\u54EA\uFF0C\u4F60\u597D\uFF01\u6211\u662F\u8331\u8FEA\u4E1D\uFF01\u6211\u771F\u7684\u4EC0\u4E48\u8D26\u5355\u90FD\u77E5\u9053 \u2014 \u6211\u4EEC\u5F97\u597D\u597D\u804A\u804A\u3002"
  },
  yue: {
    professional: "\u6211\u4FC2\u8331\u8FEA\u7D72\uFF0C\u4F60\u5605\u8CEC\u55AE\u5230\u671F\u65E5\u52A9\u624B\u3002\u6211\u6703\u78BA\u4FDD\u4F60\u6C38\u9060\u5514\u6703\u4FFE\u6EEF\u7D0D\u91D1\u5687\u89AA\u3002",
    funny: "\u4F60\u597D\uFF01\u6211\u4FC2\u8331\u8FEA\u7D72 \u2014 \u57FA\u672C\u4E0A\u4FC2\u4F60\u6700\u6709\u8CA1\u52D9\u8CAC\u4EFB\u611F\u5605\u670B\u53CB\u3002\u5514\u4F7F\u5BA2\u6C23\uFF0C\u9806\u5E36\u4E00\u63D0\u3002",
    sarcastic: "\u8331\u8FEA\u7D72\u55BA\u5EA6\u3002\u63D0\u9192\u4F60\u4EA4\u8CBB\u3002\u56E0\u70BA\u986F\u7136\u8981\u6709\u4EBA\u505A\u5462\u4EF6\u4E8B\u3002",
    mom: "\u4F60\u597D\uFF0C\u6211\u4FC2\u8331\u8FEA\u7D72\u3002\u6211\u6703\u5E6B\u4F60\u76EF\u4F4F\u6240\u6709\u8CEC\u55AE\u3002\u5514\u4F7F\u64D4\u5FC3\uFF0C\u4E00\u5207\u76E1\u5728\u638C\u63E1\u4E4B\u4E2D\u3002",
    marites: "\u5929\u554A\uFF0C\u4F60\u597D\uFF01\u6211\u4FC2\u8331\u8FEA\u7D72\uFF01\u6211\u771F\u4FC2\u77E5\u9053\u4F60\u6240\u6709\u5605\u8CEC\u55AE \u2014 \u6211\u54CB\u8981\u597D\u597D\u50BE\u5413\u3002"
  },
  id: {
    professional: "Aku Judith, asisten tanggal jatuh tempo kamu. Aku memastikan kamu tidak pernah terkejut dengan denda keterlambatan.",
    funny: "Halo! Aku Judith \u2014 pada dasarnya teman paling bertanggung jawab secara finansial kamu. Sama-sama, omong-omong.",
    sarcastic: "Judith di sini. Aku mengingatkan kamu soal tagihan. Karena jelas seseorang harus melakukannya.",
    mom: "Halo, aku Judith. Aku akan mengawasi semua tagihan kamu. Jangan khawatir, semuanya sudah aku tangani.",
    marites: "Ya ampun, halo! Ini Judith! Aku benar-benar tahu semua tentang tagihan kamu \u2014 dan kita harus ngobrol."
  },
  ms: {
    professional: "Saya Judith, pembantu tarikh matang anda. Saya memastikan anda tidak pernah terkejut dengan caj lewat bayar.",
    funny: "Hai! Saya Judith \u2014 pada dasarnya rakan paling bertanggungjawab dari segi kewangan bagi anda. Sama-sama, by the way.",
    sarcastic: "Judith di sini. Saya mengingatkan anda tentang bil. Kerana jelas seseorang perlu melakukannya.",
    mom: "Hai, saya Judith. Saya akan memantau semua bil anda. Jangan risau, saya ada segalanya di bawah kawalan.",
    marites: "Ya Allah, hai! Ini Judith! Saya tahu betul-betul semua tentang bil anda \u2014 dan kita perlu bercakap."
  },
  vi: {
    professional: "T\xF4i l\xE0 Judith, tr\u1EE3 l\xFD ng\xE0y \u0111\xE1o h\u1EA1n c\u1EE7a b\u1EA1n. T\xF4i \u0111\u1EA3m b\u1EA3o b\u1EA1n kh\xF4ng bao gi\u1EDD b\u1ECB b\u1EA5t ng\u1EDD v\xEC ph\xED tr\u1EC5 h\u1EA1n.",
    funny: "Ch\xE0o! T\xF4i l\xE0 Judith \u2014 v\u1EC1 c\u01A1 b\u1EA3n l\xE0 ng\u01B0\u1EDDi b\u1EA1n c\xF3 tr\xE1ch nhi\u1EC7m t\xE0i ch\xEDnh nh\u1EA5t c\u1EE7a b\u1EA1n. Kh\xF4ng c\xF3 chi, nh\xE2n ti\u1EC7n.",
    sarcastic: "Judith \u0111\xE2y. T\xF4i nh\u1EAFc b\u1EA1n v\u1EC1 c\xE1c h\xF3a \u0111\u01A1n. V\xEC r\xF5 r\xE0ng ai \u0111\xF3 ph\u1EA3i l\xE0m \u0111i\u1EC1u \u0111\xF3.",
    mom: "Ch\xE0o, t\xF4i l\xE0 Judith. T\xF4i s\u1EBD theo d\xF5i t\u1EA5t c\u1EA3 h\xF3a \u0111\u01A1n c\u1EE7a b\u1EA1n. \u0110\u1EEBng lo, t\xF4i ki\u1EC3m so\xE1t m\u1ECDi th\u1EE9.",
    marites: "Tr\u1EDDi \u01A1i, ch\xE0o! L\xE0 Judith \u0111\xE2y! T\xF4i bi\u1EBFt m\u1ECDi th\u1EE9 v\u1EC1 h\xF3a \u0111\u01A1n c\u1EE7a b\u1EA1n \u0111\xF3 \u2014 v\xE0 ch\xFAng ta c\u1EA7n n\xF3i chuy\u1EC7n."
  },
  th: {
    professional: "\u0E09\u0E31\u0E19\u0E04\u0E37\u0E2D\u0E08\u0E39\u0E14\u0E34\u0E18 \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E14\u0E49\u0E32\u0E19\u0E27\u0E31\u0E19\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E0A\u0E33\u0E23\u0E30\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E09\u0E31\u0E19\u0E14\u0E39\u0E41\u0E25\u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E44\u0E1E\u0E23\u0E2A\u0E4C\u0E01\u0E31\u0E1A\u0E04\u0E48\u0E32\u0E1B\u0E23\u0E31\u0E1A\u0E25\u0E48\u0E32\u0E0A\u0E49\u0E32\u0E40\u0E25\u0E22",
    funny: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35! \u0E09\u0E31\u0E19\u0E04\u0E37\u0E2D\u0E08\u0E39\u0E14\u0E34\u0E18 \u2014 \u0E42\u0E14\u0E22\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E40\u0E07\u0E34\u0E19\u0E21\u0E32\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E22\u0E34\u0E19\u0E14\u0E35\u0E04\u0E48\u0E30",
    sarcastic: "\u0E08\u0E39\u0E14\u0E34\u0E18\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48 \u0E09\u0E31\u0E19\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E04\u0E38\u0E13\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E1A\u0E34\u0E25 \u0E40\u0E1E\u0E23\u0E32\u0E30\u0E14\u0E39\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E27\u0E48\u0E32\u0E43\u0E04\u0E23\u0E2A\u0E31\u0E01\u0E04\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E33",
    mom: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35 \u0E09\u0E31\u0E19\u0E04\u0E37\u0E2D\u0E08\u0E39\u0E14\u0E34\u0E18 \u0E09\u0E31\u0E19\u0E08\u0E30\u0E14\u0E39\u0E41\u0E25\u0E1A\u0E34\u0E25\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E07\u0E27\u0E25 \u0E09\u0E31\u0E19\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E14\u0E49",
    marites: "\u0E42\u0E2D\u0E49\u0E42\u0E2B \u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35! \u0E08\u0E39\u0E14\u0E34\u0E18\u0E19\u0E35\u0E48\u0E41\u0E2B\u0E25\u0E30! \u0E09\u0E31\u0E19\u0E23\u0E39\u0E49\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E1A\u0E34\u0E25\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E40\u0E25\u0E22 \u2014 \u0E41\u0E25\u0E30\u0E40\u0E23\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E04\u0E38\u0E22\u0E01\u0E31\u0E19"
  }
};
var generated = 0;
var skipped = 0;
console.log("\u2500\u2500 EN + FIL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
for (const persona of ALL_PERSONAS) {
  for (const { key, label, getText, getVoiceId } of [
    { key: "en", label: "EN", getText: (p) => EN_TEXT[p], getVoiceId: (p) => DEFAULT_VOICE_IDS[p] },
    { key: "fil", label: "FIL", getText: (p) => FIL_TEXT[p], getVoiceId: (p) => FILIPINO_VOICE_IDS[p] }
  ]) {
    const already = await hasSampleAudio(persona, key);
    if (already) {
      console.log(`\xB7 ${persona}/${label} (cached)`);
      skipped++;
      continue;
    }
    try {
      const audio = await synthesize(getText(persona), getVoiceId(persona), {
        live: false,
        speed: getSpeakingSpeed(persona)
      });
      await setSampleAudio(persona, key, audio.base64);
      console.log(`\u2713 ${persona}/${label}`);
      generated++;
    } catch (err) {
      console.error(`\u2717 ${persona}/${label}:`, err);
    }
  }
}
console.log("\n\u2500\u2500 Philippine English (en_PH) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
for (const persona of ALL_PERSONAS) {
  const already = await hasSampleAudio(persona, "en", "PH");
  if (already) {
    console.log(`\xB7 ${persona}/en_PH (cached)`);
    skipped++;
    continue;
  }
  try {
    const audio = await synthesize(EN_TEXT[persona], PHILIPPINE_ENGLISH_VOICE_IDS[persona], {
      live: false,
      speed: getSpeakingSpeed(persona)
    });
    await setSampleAudio(persona, "en", audio.base64, "PH");
    console.log(`\u2713 ${persona}/en_PH`);
    generated++;
  } catch (err) {
    console.error(`\u2717 ${persona}/en_PH:`, err);
  }
}
console.log("\n\u2500\u2500 Other languages \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
for (const [langCode, lines] of Object.entries(OTHER_LANG_TEXT)) {
  for (const persona of BASE_PERSONAS) {
    const already = await hasSampleAudio(persona, langCode);
    if (already) {
      console.log(`\xB7 ${persona}/${langCode} (cached)`);
      skipped++;
      continue;
    }
    try {
      const text = persona === "britney" ? EN_TEXT.britney : lines[persona];
      const voiceId = DEFAULT_VOICE_IDS[persona];
      const audio = await synthesize(text, voiceId, {
        live: false,
        speed: getSpeakingSpeed(persona)
      });
      await setSampleAudio(persona, langCode, audio.base64);
      console.log(`\u2713 ${persona}/${langCode}`);
      generated++;
    } catch (err) {
      console.error(`\u2717 ${persona}/${langCode}:`, err);
    }
  }
}
console.log(`
Done \u2014 ${generated} generated, ${skipped} already cached.`);
//# sourceMappingURL=pregen-persona-samples.mjs.map
