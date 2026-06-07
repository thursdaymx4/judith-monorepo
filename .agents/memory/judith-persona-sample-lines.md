---
name: Judith persona sample lines
description: API server's SAMPLE_LINES split into FIL and EN; getSampleText picks based on language
---

The `/sample` and `/sample-onboarding` endpoints both use `getSampleText(persona, language)` to pick the correct text:
- Filipino family codes (`fil`, `ceb`, `ilo`, `hil`) → `SAMPLE_LINES_FIL` (Tagalog text)
- Everything else → `SAMPLE_LINES_EN` (English text)

**Why:** The original `SAMPLE_LINES` was 100% Tagalog. English users heard Filipino words spoken with an English-accented voice.

**How to apply:** When adding a new language or updating persona intros, update BOTH `SAMPLE_LINES_FIL` and `SAMPLE_LINES_EN` in `artifacts/api-server/src/routes/judith.ts`. The client-side `PERSONA_FIL_SAMPLES` in the onboarding index handles the Filipino path directly (client sends text to `synthOnboarding`); the EN path goes through `fetchSampleOnboarding` → server's `getSampleText`.
