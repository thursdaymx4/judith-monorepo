---
name: Judith Ask reply number formatting
description: Money amounts in Ask AI replies must be numeric digits, not spelled-out words; negative amounts need special handling for TTS.
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

# Negative amounts (confirmed working — user-approved)

**Problem:** The AI wrote `₱-1,000` (minus sign AFTER the symbol). ElevenLabs read this
as *"P 1,000"* — silently dropped the sign, no "negative" spoken.

**Two-layer fix (both required):**

1. **System prompt rule (personas.ts NUMBER FORMATTING):** Tell the AI to write deficits
   as `"negative ₱X,XXX"` — word "negative" BEFORE the currency symbol, not `₱-X,XXX`.
   Example: `"negative ₱1,000"` not `"₱-1,000"`.

2. **`prepareForTTS` (elevenlabs.ts) regex hardening:** Updated to catch all patterns:
   - `₱-1,000`  → "negative one thousand pesos"
   - `-₱1,000`  → "negative one thousand pesos"
   - `₱1,000`   → "one thousand pesos" (unchanged)
   Old regex `/₱\s?([\d,]+)/` only matched positive digits.

**Why both layers:** Prompt rule prevents the bad form from being generated; regex is
the safety net if any `₱-X` slips through (e.g. from context data, not AI output).

**Confirmed correct response pattern (user-approved):**
> "mga ₱-1,000 ka na!" → spoken as "negative one thousand pesos"
