# FIDELITY_CHECKLIST.md — does the build match the design?

Per-screen acceptance checklist. Use it two ways: tell Claude Code "verify this screen against FIDELITY_CHECKLIST.md," and tick items yourself with the matching `screenshots/` image open side-by-side. A screen is **done** only when every box is checked.

Legend: ☐ todo · ✅ done · ⚠️ intentional difference (note why)

---

## 0. Global (applies to every screen)
- ☐ Colors come from `theme.ts` tokens — **no hardcoded hex** in components
- ☐ Accent is the locked mint `oklch(0.78 0.15 168)` (never purple/blue)
- ☐ Fonts: Space Grotesk (UI), JetBrains Mono (**all** ₱ amounts, tabular), Playfair italic (only splash "Handled.")
- ☐ Money rendered via `money(amount, currency)` — symbol + thousands separator + **no decimals**
- ☐ Works in **dark and light**; urgency colors (overdue/urgent/near/ok) correct in both
- ☐ Hit targets ≥ 44px; text never < 13px
- ☐ UI text is **English only**; currency/providers/food-joke/endearment localize by country
- ☐ Spacing/radii match (24/16/12); cards use the right surface + hairline border
- ☐ Reads live data (Supabase), not the dev seed, outside development

---

## 1. Intro
**Splash** · `00-splash.png`
- ☐ Logo + "Judith" wordmark; tagline settles to "Judith: Due Dates, Handled."
- ☐ "Handled." punches in (zoom/blur → overshoot → settle + glow), delayed, with a haptic
- ☐ International bill-category motifs (not PH providers)
- ☐ Judith's face persists smoothly into Login (no flash/disappear)

**Login** · `01-auth.png`
- ☐ Social layout (Apple + Google + email/password); avatar above "Welcome" (no overlap)
- ☐ Apple Sign-In present (required if other socials shown)

## 2. Onboarding (16) — match each screenshot
- ☐ `01` Meet Judith — avatar (not orb), headline + "Let's begin" → **sweep** transition
- ☐ `02` Where you live — country list + flags; sets currency/providers
- ☐ `03` Language — "tap to hear me" plays ElevenLabs sample (pulse micro-interaction)
- ☐ `04` Pick persona — 2×2 cards, play-voice, same Judith different style per persona
- ☐ `05` Late-fee hook — persona-tailored headline, "paid" red+underlined → **failure transition + strong haptic**
- ☐ `06` Quick question — choice (know/don't, recorded); long subs list
- ☐ `07` The fork — left/right split, anxious vs calm faces, down-trend arrow; commit → **zoom+flip "You will start taking control today"** with 2s hold
- ☐ `08` Before we start — 5–7 min expectation + save point (resume index persists)
- ☐ `09` Tell your bills (voice) — rent asked first; parse to provider/amount/type/category; "I don't have this" + "Type instead"; count-driven cards & loans
- ☐ `10` All set · `11` Personalizing (fake loading) · `12` Money summary (bars labeled, biggest bill/category/next due)
- ☐ `13`–`15` Three Ask demos — distinct questions + avatar moods
- ☐ `16` Asks paywall — Judith+ ₱99 / Unlimited ₱199 + "Continue with 8 free asks"

## 3. App tabs
**Home (Calm — LOCKED)** · `20-app-home.png`
- ☐ Greeting bubble + bell (urgent badge)
- ☐ Slim **overdue strip** only when a bill is past due
- ☐ ONE hero card: "Due this month ₱X" + thin paid bar + "₱ paid · ₱ to go"
- ☐ "Up next" — 3 bills + "See all"
- ☐ One-line streak pill → opens Monthly Recap
- ☐ Avatar FAB → Ask Judith
- ☐ No other home layout present (ring/agenda/timeline abandoned)

**Calendar** · `21-app-calendar.png`
- ☐ Heat-map month grid, provider logos on bill days, tap day → agenda
- ☐ Weekly cash flow with **year-aware** date ranges; legend

**Insights** · `22-app-insights.png`
- ☐ KPIs + donut by category + 6-mo trend + top providers (amounts mono)
- ☐ Compact filters: range (1M/3M/6M/1Y) + Category + Provider + **House** chip (only if >1 house) re-scopes everything
- ☐ No calendar here

**Settings** · `25-app-settings.png`
- ☐ Account row → Account screen; Plan card (₱199 lifetime · Active); Ask Judith row → paywall
- ☐ Dark/Light toggle; 4 personas; 5 ElevenLabs voices + English-only note
- ☐ Reminders/widget/watch/payment-nudge toggles; "Preview on devices"; Monthly recap row

## 4. Overlays & sheets
- ☐ `23` Bills list — Category / Provider / Due-date filters
- ☐ `24` Bill detail — overdue note (in-persona) when late; "How did you pay?" chips (GCash/Bank/Card/Cash); Mark paid / Snooze / Edit; paid stamp shows method; recent-payments chart
- ☐ `26` Add bill — Manual: category + **type (Fixed/Variable) half-split**, rent/mortgage subtype, "Which home?" (if >1), learned-provider suggestions
- ☐ `27` Scan bill — viewfinder + shutter → **Confirm** flow with editable fields + low-confidence "check this" flag
- ☐ `28` Plans paywall — two selectable tiers, CTA reflects selection
- ☐ `30` Ask Judith — persona greeting empty state, quick chips, mic, metering pill (amber ≤3, lock at 0), off-topic deflection
- ☐ `31` Reminders — lock-screen notification preview (persona copy) + Pay/Snooze + scheduled list grouped
- ☐ `32` Devices — home/lock-screen widgets + Apple Watch concepts
- ☐ Account — profile, Face-ID lock, change password, subscription mgmt + **Restore purchases**, export data, **log out**, **delete account**
- ☐ Monthly Recap — "every bill on time", streak, fees avoided, biggest category, vs last month

## 5. Motion (re-feel in Reanimated, don't transcribe)
- ☐ List items stagger-rise; due-soon glow pulse; number count-ups
- ☐ Onboarding: sweep (begin), stamp (country), failure+haptic (hook), zoom→flip+2s hold (fork commit)
- ☐ Reduced-motion setting disables non-essential animation

## 6. Avatar (budget extra time)
- ☐ Replace the placeholder generator with a **consistent commissioned character** — one base Judith, 4 persona styles × a few expressions + listening/speaking states
- ☐ Same person across all surfaces (not different faces); friendly + colorful
- ☐ States used correctly: idle (home/avatars), listening + speaking (Ask/voice add-bill)

## 7. Integrations (acceptance)
- ☐ **Supabase:** RLS on every table; auth (email+Apple+Google); `bill_cycles` monthly roll-over works; variable bills prompt new amount
- ☐ **RevenueCat:** 3 products live; entitlements gate features off `customerInfo` (not a local flag); tier switch works; restore works
- ☐ **Metering:** 8 free → 50/mo (plus) → ∞ (unlimited); 10/hour cap; lock + paywall when exceeded
- ☐ **ElevenLabs:** English-only speech via `judith-tts` Edge Function; key not in client; canned lines cached
- ☐ **Claude:** `ask-judith` Edge Function; scope-locked to user's bills; off-topic deflection; offline fallback; key not in client
- ☐ **Notifications:** scheduled `leadDays` before due at the user's time; Pay/Snooze actions; permission requested in context
- ☐ **OCR:** scan extracts provider/amount/due/category with per-field confidence; low-confidence flagged

## 8. Store readiness
- ☐ In-app account deletion; subscription price/period/restore + Terms/Privacy links
- ☐ Permission purpose strings (notifications, camera); requested in context, not on launch
- ☐ No web-wrapper — native screens only
- ☐ `eas build` + `eas submit` configured; push/camera/IAP tested on real device/sandbox

---
*When something can't match exactly (a web-only effect), mark it ⚠️ with a one-line reason rather than leaving it ☐ — that keeps "intentional" separate from "unfinished."*
