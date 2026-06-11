---
name: Judith persona sample en_PH cache slot
description: Why PH users hit slow live persona-preview synthesis, and the cache slot that must be pregenerated.
---

# PH persona preview = en_PH cache slot

PH users (countryCode=PH) send countryCode=PH to the persona-sample/preview path. The
server resolves their voice via PHILIPPINE_ENGLISH_VOICE_IDS and keys the cache by
`sampleLangKey(lang, countryCode)` → slot `en_PH` (NOT plain `en`).

If the pregen script only writes the `en` / `fil` / other-language slots and never
`en_PH`, every PH preview is a cache MISS → live ElevenLabs synthesis (>10s) + a giant
base64 payload returned inline → Settings UI freezes (can't switch tabs).

**Why:** the cache key is country-aware but the generator wasn't. A missing slot fails
silently as "slow", not as an error.

**How to apply:** `pregen-persona-samples.ts` MUST include an explicit en_PH loop over
all 6 personas (`setSampleAudio(persona,"en",base64,"PH")`), and `hasSampleAudio` MUST
take countryCode and use `sampleLangKey(lang,countryCode)`. After editing, RUN the
"Pregen Persona Samples" workflow — editing the script doesn't generate the files. Any
new country with a dedicated voice-ID map needs its own pregen slot too.
