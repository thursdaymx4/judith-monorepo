---
name: Judith languages, dialects & countries
description: How spoken-language, dialect sub-options, and country data are wired for international support
---

# Judith internationalization model

Scope of supported languages = where ElevenLabs has excellent voices (the
`eleven_multilingual_v2` / `eleven_flash_v2_5` set, ~32 langs) plus a few strong
`eleven_v3` additions (e.g. Thai). Source of truth: `constants/languages.ts`
(`LANGUAGES`) and `constants/countries.ts` (`COUNTRIES`).

## Dialects
Dialects are sub-options under a language, listed **only where the spoken TEXT
genuinely differs** — not mere accent. Accent comes from the chosen *voice*, not
a language code, so do NOT add "US/UK English" or "Spain/LatAm Spanish" as
dialects (their text is identical → misleading). Real dialect text differs:
- Filipino → Tagalog/Taglish, Cebuano (ceb), Ilocano (ilo), Hiligaynon (hil)
- Chinese → Mandarin (zh), Cantonese (yue)
- Arabic → MSA (ar), Egyptian (arz), Levantine (apc), Gulf (afb)
- Portuguese → Brazilian (pt), European (pt-PT)

Each language/dialect carries its own `sample` (Judith's reminder line spoken to
preview) and `sttCode` (ISO hint for Scribe).

## How the pieces connect
- The store's `language` field holds the precise code, **including dialect codes**.
- TTS is auto-detect from text — picking a dialect just feeds dialect-language
  `sample` text to the multilingual model; no model param needed.
- STT: `sttHint(code)` → passed as `language_code` to ElevenLabs Scribe.
  **Why:** improves transcription accuracy for the chosen language/dialect.
  **Safety:** `transcribe()` in `api-server/lib/elevenlabs.ts` retries WITHOUT
  the hint if Scribe rejects an unsupported code, so STT never fails because of it.
- Filipino narration: any Filipino-family code (fil/ceb/ilo/hil) must use the
  Filipino onboarding voice lines. Use `isFilipino(code)` — never `=== "fil"` —
  or dialect speakers get English narration. (We only have `fil` translations.)

## Money & dates are ALWAYS plain English (every language)
The conversational reply is localized, but money amounts, weekdays, and dates
must be spoken/written in plain natural English in EVERY language (not just
Taglish) — e.g. "three thousand pesos", "Thursday", "June 5".
**Why:** numbers/dates spoken in the user's own language sound off/unnatural in
TTS. **How to apply:** enforced in `api-server/src/lib/personas.ts`
`languageInstruction()` — BOTH the Filipino branch and the other-language branch
carry this rule (the non-Filipino branch had previously localized them). The bill
context (`buildBillsContext`/`buildClientContext` in `routes/judith.ts`) already
emits English forms via `curStr` (en-US), `englishDate`, `englishWeekday`,
`amountToWords` in `lib/normalize.ts` — keep the prompt and context in lockstep.

## Adding a language/dialect
Add to `LANGUAGES` (sample + desc + sttCode), and if it maps to a new country,
add to `COUNTRIES` + `COUNTRY_FOOD` + `MOM_ENDEARMENT` (all keyed by country code).
