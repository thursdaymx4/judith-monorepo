---
name: Judith money formatting
description: How money is formatted app-wide and the TTS gotcha when adding decimals
---

# Judith money formatting

All on-screen money uses the pattern `000,000.00` (thousands separators + 2 decimals).
The central formatter is `formatMoney` in `constants/data.ts`, surfaced everywhere via
the store's `money()`. Sibling display formatters kept in lockstep: `pesoDisplay`
(lib/tagalog.ts), `pesoStr` (lib/notifications.ts), `fmtFee` (constants/paywallLocale.ts),
and onboarding's `fmtNum`.

**Why / gotcha:** onboarding has dynamic lines that are spoken via `synthOnboarding`
(text-to-speech). If a money formatter that those spoken strings use emits `.00`, TTS
reads "point zero zero". So onboarding keeps a separate `fmtSay` (rounded, no decimals)
for the spoken summary/congrats lines, while `fmtNum` (display) carries the 2 decimals.

**How to apply:** before adding decimals to ANY shared money formatter, grep its callers
for `synthOnboarding` / TTS paths and route those through a decimal-free helper. Also
intentionally excluded from the 2-decimal rule: compact chart "k" abbreviations,
amount-input placeholders, and the ask.tsx spoken fallback (conversational, rounded).
