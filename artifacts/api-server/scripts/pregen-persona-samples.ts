/**
 * pregen-persona-samples.ts
 *
 * Pre-generates persona voice sample audio files for the Settings personality
 * picker and stores them in object storage (GCS) so tapping a persona card
 * plays instantly without a live ElevenLabs call.
 *
 * Scope: 6 personas × 2 language groups (en + fil) = 12 audio files
 *
 * Run:
 *   pnpm --filter @workspace/api-server run pregen-persona-samples
 *
 * Fully resumable — checks GCS before generating and skips cached files.
 */

import { synthesize } from "../src/lib/elevenlabs.js";
import {
  DEFAULT_VOICE_IDS,
  FILIPINO_VOICE_IDS,
  getSpeakingSpeed,
  type PersonaId,
} from "../src/lib/personas.js";
import { setSampleAudio, hasSampleAudio } from "../src/lib/audioCache.js";

const PERSONAS: PersonaId[] = [
  "professional",
  "funny",
  "sarcastic",
  "mom",
  "marites",
  "britney",
];

const EN_TEXT: Record<PersonaId, string> = {
  professional:
    "I'm Judith — your due date assistant. I track every bill so you're never hit with a late fee again.",
  funny:
    "Hi! I'm Judith — basically your most financially responsible friend. You're welcome, by the way.",
  sarcastic:
    "Judith here. I remind you about your bills. Because apparently that's something someone has to do.",
  mom:
    "Hi there — I'm Judith. I'll keep an eye on all your bills for you. Don't worry, I've got everything covered.",
  marites:
    "Oh my gosh, hi! It's Judith! I literally know everything about your bills — and trust me, we need to talk!",
  britney:
    "Judith. Bills, amounts, due dates — tracked. Pay them on time. That's the deal.",
};

const FIL_TEXT: Record<PersonaId, string> = {
  professional:
    "Si Judith 'to. Bantayan ko ang lahat ng due dates mo — wala kang mapapala sa late fees, so ayusin natin 'yan.",
  funny:
    "Uy! Si Judith — 'yung pinaka-responsible mong kaibigan pagdating sa bills. Hindi ka na late, promise. Mostly.",
  sarcastic:
    "Si Judith 'to. Oo, nagpapa-alaala ako ng bills mo. Kasi ikaw? Ikaw talaga. Sige, tara na.",
  mom:
    "Anak, si Judith 'to. Nandito na ako, 'wag kang mag-alala. Bantayan ko ang mga bayarin mo — walang makakalusot sa akin, ha.",
  marites:
    "Besh, chismis muna! Si Judith 'to — at alam ko na lahat ng bills mo! Grabe, 'di ba? Wala kang makakalimutan, promise. Mag-update ka ha!",
  britney:
    "Judith. Bills mo, due dates, amounts — naka-track na lahat. 'Yun lang.",
};

type LangGroup = { key: "en" | "fil"; label: string; getText: (p: PersonaId) => string; getVoiceId: (p: PersonaId) => string };

const LANG_GROUPS: LangGroup[] = [
  {
    key: "en",
    label: "EN",
    getText: (p) => EN_TEXT[p],
    getVoiceId: (p) => DEFAULT_VOICE_IDS[p],
  },
  {
    key: "fil",
    label: "FIL",
    getText: (p) => FIL_TEXT[p],
    getVoiceId: (p) => FILIPINO_VOICE_IDS[p],
  },
];

let generated = 0;
let skipped = 0;

for (const lang of LANG_GROUPS) {
  for (const persona of PERSONAS) {
    const already = await hasSampleAudio(persona, lang.key);
    if (already) {
      console.log(`· ${persona}/${lang.label} (cached)`);
      skipped++;
      continue;
    }
    try {
      const text = lang.getText(persona);
      const voiceId = lang.getVoiceId(persona);
      const audio = await synthesize(text, voiceId, {
        live: false,
        speed: getSpeakingSpeed(persona),
      });
      await setSampleAudio(persona, lang.key, audio.base64);
      console.log(`✓ ${persona}/${lang.label}`);
      generated++;
    } catch (err) {
      console.error(`✗ ${persona}/${lang.label}:`, err);
    }
  }
}

console.log(`\nDone — ${generated} generated, ${skipped} already cached.`);
