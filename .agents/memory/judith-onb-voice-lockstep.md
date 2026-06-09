---
name: Judith onboarding voice lockstep
description: Three files must stay in sync for onboarding voice cache to work; ONB_LINE_TO_CONCEPT also needs updating when voiceLines change.
---

## Rule

Three files must stay in lockstep whenever onboarding voice lines change:

1. `artifacts/judith/constants/voiceLines.ts` — client sends these exact strings to the server
2. `artifacts/api-server/scripts/pregen-onb-voice.ts` — EN_TEXT / FIL_TEXT must match voiceLines exactly so pregen writes the right audio to GCS
3. `artifacts/api-server/src/routes/judith.ts` → `ONB_LINE_TO_CONCEPT` — server maps client-sent text → concept key to look up the GCS cache path

If any diverge, the pregen writes audio under the wrong key or ONB_LINE_TO_CONCEPT misses a lookup and falls back to live TTS (cache miss).

**Why:** The GCS cache key is `onb-voice/{concept}/{persona}/{lang}.mp3`. The server resolves concept via `ONB_LINE_TO_CONCEPT[text]`. If the client sends a string that isn't in ONB_LINE_TO_CONCEPT, every request hits ElevenLabs live — slow + costly.

## Encoding gotcha

`judith.ts` stores Unicode escapes as literal 6-char sequences (`\u2019`, `\u2014`), NOT as actual UTF-8 chars. Python `str.replace()` with `\u2019` (the actual char) will NOT match. Use raw string matching: `\\u2019` in Python source to match the literal backslash-u sequence in the file.

## Features screens changed

The original ONB_LINE_TO_CONCEPT was written for an older mic-based features flow ("Go ahead — ask me anything", "Try asking what's due this week"). The current flow uses tap-the-question cards. Any new feature-screen redesign must update all three files + re-run pregen.

## Britney persona

The `britney` persona was added to voiceLines.ts and pregen-onb-voice.ts but initially omitted from ONB_LINE_TO_CONCEPT entirely — causing every britney onboarding TTS request to miss the cache. Always add all 6 persona entries to ONB_LINE_TO_CONCEPT when adding a new persona.

## Pregen re-run

After any EN_TEXT change, run:
```
pnpm --filter @workspace/api-server run pregen-onb-voice
```
This overwrites stale GCS entries. Previously cached FIL entries remain valid and are skipped automatically.
