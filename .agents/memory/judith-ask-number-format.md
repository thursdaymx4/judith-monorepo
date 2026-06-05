---
name: Judith Ask reply number formatting
description: Money amounts in Ask AI replies must be numeric digits, not spelled-out words.
---

# Ask reply number formatting (digits, not words)

Judith's Ask AI replies must render money amounts as numeric digits with thousands
separators and the currency symbol (e.g. "₱438,835"), NEVER spelled out as words.

**Why:** Digits are far more readable in chat; the user asked for this as an enforced
rule. Spelled-out output came from the persona few-shot examples + language rules, which
the model mimicked — the bill data context was already digit-formatted.

**How to apply:**
- The single reply string feeds BOTH chat display AND ElevenLabs TTS. ElevenLabs reads
  digits naturally, so digits are safe for voice — do NOT reintroduce a spelled-out
  variant for TTS.
- Enforcement is purely prompt-side (system prompt rule + persona few-shot examples +
  both language-rule branches). There is no output-side validator, so drift is possible;
  if stricter guarantees are needed, add a post-generation check + single reprompt.
- The spelled-out-number examples in the onboarding bill-PARSE prompt are *user input*
  interpretation, not Judith output — leave them spelled out.
- normalize.ts amountToWords/intToWords reintroduce spelled-out output; keep unused here.
