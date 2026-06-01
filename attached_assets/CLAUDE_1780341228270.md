# CLAUDE.md — Judith (React Native + Expo)

Persistent instructions for building Judith in this repo. Read `README.md` and `SPEC.md` first.

## Product in one line
A **bill due-date tracker** with a persona-driven assistant ("Judith"). Tracks bills, reminds before due dates, answers money questions by voice. **Tracker, not a payer** — never moves money; users mark bills paid + log method.

## Stack & conventions
- **Expo (SDK latest) + Expo Router + TypeScript.** File-based routes under `app/`.
- **Styling:** central `theme.ts` from SPEC §2 tokens. Prefer a tokens object + a small `<Text>`/`<Box>` system or `nativewind` — do not hardcode hex in components.
- **Money:** always render via a `money(amount, currency)` helper → symbol + `toLocaleString` + no decimals, in the mono font. Never bare numbers.
- **State:** server state from Supabase via TanStack Query; light local UI state with React state/Zustand. Persist onboarding resume index + chosen country/persona/voice/theme.
- **Fonts:** Space Grotesk (UI), JetBrains Mono (amounts), Playfair Display italic (splash "Handled." only). Load with `expo-font`.
- **Icons:** match the prototype's line-icon set (see `source/japp-data.jsx` `Icon`). Use a comparable RN icon lib or port the SVGs.

## Hard rules
- **UI text is English everywhere.** Do NOT localize the interface. Only Judith's *spoken* voice (ElevenLabs) is multilingual — and always English by default.
- **Currency, providers, the "comfort-food" joke, and the "mom" endearment ARE localized by country** (see SPEC §3.5). Currency symbol comes from the user's country.
- **Never embed API keys in the app.** Claude and ElevenLabs are called through a server proxy (Supabase Edge Functions). The client never holds those secrets.
- **Accent is locked:** `oklch(0.78 0.15 168)` (mint-green). Don't reintroduce the purple/blue candidates.
- **Home layout is locked to "Calm"** (hero "due this month" card + thin paid bar + "Up next" list + slim overdue strip + one-line streak pill). Other layouts in the prototype are abandoned — don't build them.
- **Avatar, not an orb.** Judith is a female persona avatar shown across the app; 4 persona styles, positive expressions/poses. In the prototype she's generated via DiceBear as a placeholder — for production, swap in a commissioned consistent character set (one base, 4 persona styles × a few expressions + listening/speaking states). Keep it friendly and colorful.

## Urgency model (exact)
`overdue` if daysUntilDue < 0 · `urgent` ≤3 · `near` ≤7 · `ok` otherwise. Colors map to `--overdue/--urgent/--near/--ok`.

## The monthly loop (core — get this right)
- Bills recur monthly. On "mark paid", record `paidVia` + `paidOn`, and the bill rolls to next cycle's due date. Variable bills (e.g. electricity) prompt for the new amount each cycle.
- **Overdue** bills surface in a slim red strip on Home + a gentle in-character Judith line on the detail sheet.
- Track **on-time streak** + **late fees avoided** (running tally) — shown as the Home streak pill and the Monthly Recap.

## Voice-first add-bill (signature interaction)
Voice first, tap second. Judith asks for each bill; user speaks; parse into provider/amount/due/category for confirm. Essentials asked one-by-one (rent first), then subscriptions, then **count-driven** cards & loans ("how many?" → loop that many). Every prompt offers "I don't have this" + "Type instead". See SPEC §6 and `source/j-screens-b.jsx`.

## Ask Judith (live AI)
Metered: 8 free → Judith+ (₱99/50 per month) or Unlimited (₱199/mo); fair-use 10/hr. Scope-LOCKED to the user's bills/dates/totals/payments; politely deflects off-topic (the country-food joke). See `integrations/claude-ask.md`.

## App Store / Play review notes (finance + subscriptions)
- Provide an account-deletion path in-app (Account screen has it) — required by both stores.
- Subscriptions need clear price, period, and a restore-purchases path (RevenueCat) + links to Terms/Privacy.
- Request notification + camera permissions with clear purpose strings; don't request on launch — request in context (reminders setup / scan).
- No web-wrapper. Native RN screens only.

## Definition of done per screen
Matches the screenshot at `screenshots/INDEX.md`, uses theme tokens (no hardcoded color), money in mono, works in dark + light, hit targets ≥44px, and reads its data from Supabase (not the demo seed) outside of dev.
