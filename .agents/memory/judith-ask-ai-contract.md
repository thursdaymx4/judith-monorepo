---
name: Judith Ask AI contract (local store)
description: How the Judith app's local-bills store feeds /api/judith/ask, and two non-obvious constraints that silently break voice/date answers.
---

# Judith "Ask" AI contract

The app uses a LOCAL bills store (not Supabase), so the client must pass its own
context to the AI. `/api/judith/ask` accepts optional `{ bills, persona }` in the
request body; when `bills` is an array it builds context from those, otherwise it
falls back to `loadUserData()` (Supabase). Client `lib/proxy.ts` maps client
persona ids → server ids via `PERSONA_MAP` (`pro→professional, funny→funny,
sib→sarcastic, mama→mom`) for `askJudith`, `synthesize`, and `fetchSample`.

## Constraint 1 — never send the local placeholder voiceId to /ask
The store's `voiceId` values (`rachel`, `antoni`, …) are display placeholders, NOT
real ElevenLabs voice IDs. Sending them to ElevenLabs fails synthesis.
**How to apply:** for `/ask`, send only `persona`; the server picks a real voice via
`DEFAULT_VOICE_IDS[persona]`. Each persona therefore already gets a distinct voice
server-side (this is why the "distinct female voice per persona" follow-up was
obsolete).

## Constraint 2 — buildClientContext date must be runtime, not hardcoded
`buildClientContext()` builds the "Today is …" line. The bills carry relative
`dueDays`, so "due this week / next due" are date-agnostic, but a hardcoded literal
date makes "what's today" and any absolute-date answer drift over time.
**Why:** a hardcoded `"Today is June 1, 2026."` was caught in review — it silently
rots. **How to apply:** always pass `new Date()` and format with
`englishDate`/`englishWeekday`.

## Constraint 3 — recompute due dates live; stored dueDays/dueLabel are stale
A store Bill's `dueDays`/`dueLabel` are snapshots the store NEVER refreshes (it only
recomputes the natural *period* from `dueDate`). The Calendar recomputes due days
live from `dueDate`; anything that reads stored `b.dueDays`/`b.dueLabel` will drift
out of sync. **Why:** Ask once told a user a bill due *today* was due "next month"
and "nothing this week" while the Calendar showed it due today — Ask was forwarding
the stale snapshot. **How to apply:** compute due dates from `dueDate` via
`nextOccurrence(bill, new Date())` in `constants/data.ts` (monthly: `candidate < base`
so due-today stays today, clamp to days-in-month; annual: keep stored dueDays). All
roll-forward date math (`makeBillFromAction`, `makeManualBill`, `computeNextDue`)
must use `< base`, never `<= base`.

Two live helpers exist in `constants/data.ts`, pick by what the surface needs:
- `nextOccurrence` (roll-forward, never negative) — for "what's your NEXT bill" and
  for scheduling future things. Used by Ask and `lib/notifications.ts` (you cannot
  schedule a reminder in the past, so notifications MUST roll forward).
- `currentCycleDue` (SIGNED current-month offset; passed-but-unpaid stays negative) —
  for surfaces with an OVERDUE state. Used by home `app/(tabs)/index.tsx` and
  `lib/watch.ts`; mirrors `calendar.tsx` `viewedDueDays` current-month branch. Using
  roll-forward here would silently destroy the overdue concept.
The home screen injects live values via `bills.map(b => ({...b, ...currentCycleDue(b)}))`
BEFORE any due/week/soon/overdue computation — the spread preserves parentCardId etc.
