---
name: Judith money formatting
description: Money display is whole-number; 2 decimals only appear in money INPUT fields
---

# Judith money formatting

**Rule:** on-screen money DISPLAY is whole-number with thousands separators (e.g.
`300,000`), NO decimals. Two decimals (`000,000.00`) appear ONLY inside money INPUT
fields (add-bill amount, bill-detail payment + statement inputs), because users need
to enter centavos there.

**Why:** the user found `.00` on every viewed amount visually messy and explicitly
asked to strip decimals from all display while keeping them for input.

**How to apply — display formatters (must stay whole-number):**
- `formatMoney` (constants/data.ts) → `Math.round(n).toLocaleString("en-US")`; surfaced
  everywhere via the store's `money()`.
- `pesoDisplay` (lib/tagalog.ts) → conditional centavos only when the value actually has
  them (`hasCentavos`), else no decimals.
- `pesoStr` (lib/notifications.ts), `fmtFee` (constants/paywallLocale.ts), onboarding
  `fmtNum` (app/(onboarding)/index.tsx) → all whole-number.

**How to apply — input fields (2 decimals):** each money TextInput formats on blur via a
local `to2dp`/`fmt2` helper (`toLocaleString("en-US",{minimumFractionDigits:2,
maximumFractionDigits:2})`), seeds its initial/edit value formatted, and shows a `0.00`
placeholder. Parsers strip commas (`replace(/,/g,"")` / `[^0-9.]`) so comma-formatted
input round-trips safely. Onboarding amount inputs intentionally left unformatted (one-time
flow; they already accept decimal entry).

**TTS note:** onboarding spoken summary lines use `fmtNum`; since display is now
decimal-free, no separate `fmtSay` helper is needed. If decimals are ever re-added to a
shared formatter, route `synthOnboarding`/TTS callers through a rounded helper so TTS
never reads "point zero zero".
