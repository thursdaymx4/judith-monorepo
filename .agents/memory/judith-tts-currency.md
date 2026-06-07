---
name: Judith TTS currency normalization
description: How currency symbols are normalized before ElevenLabs synthesis so they are spoken naturally
---

## Rule

All currency symbols must be converted to spoken words in `prepareForTTS` (elevenlabs.ts) before the text reaches ElevenLabs. Without this, "A$1,380" is read as "A dollar one thousand three hundred eighty".

## How it works

`CURRENCY_SPOKEN` array (longest symbols first to prevent partial matches):
- CA$ → Canadian dollars, A$ → Australian dollars, NZ$ → New Zealand dollars
- HK$ → Hong Kong dollars, S$ → Singapore dollars, US$ → dollars
- £ → pounds, € → euros, ¥ → yen, ₩ → won, ₹ → rupees
- ﷼ → riyals, ฿ → baht, ₫ → dong

Single-pass regex per symbol handles all sign variants:
- "A$1,380" → "1,380 Australian dollars"
- "negative A$1,380" / "-A$1,380" → "negative 1,380 Australian dollars"

₱ is handled separately (Step 2):
- Filipino/English: full word-spelling via intToWords ("three thousand pesos")
- Other languages: digit form ("3,000 pesos")

**Why:** ElevenLabs reads multi-character prefixes letter-by-letter ("A", "C", "A") instead of as currency names. The display text stays as "A$1,380" (correct); only the TTS input is normalized.

## System prompt rule (personas.ts)

Added to NUMBER FORMATTING section:
> TTS RULE — NEVER write multi-character currency prefixes bare like "A$", "CA$", "NZ$". Always write the full symbol as provided — the TTS layer converts it automatically. Do NOT improvise alternate spellings like "AUD", "A dollars".
