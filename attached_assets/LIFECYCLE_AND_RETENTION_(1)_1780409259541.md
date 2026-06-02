# LIFECYCLE_AND_RETENTION.md — the post-setup app (monthly loop, account, states, international, retention)

> **Why this file exists:** the original build nailed *setup* (onboarding). These 7 areas are **what happens every month after** — and they're already designed in the prototype but easy to miss because they're spread across the app shell, bill detail, home, and two new screens (`RecapScreen`, `AccountScreen`). Build all of them. Source of truth: `source/japp-extras.jsx`, `source/japp-bills.jsx` (BillDetailSheet), `source/japp-home.jsx` (OverdueStrip / TrackPill / HomeEmpty), `source/japp-data.jsx` (TRACK_RECORD, MONTH_RECAP, PROVIDERS_INTL, providersFor).

**Decisions locked (from product):**
- **Judith is a TRACKER, not a payer.** She never moves money. "Mark as paid" records that the user paid elsewhere + how. No in-app GCash/card rails, no "Pay now that charges money."
- **Due dates are entered MANUALLY** (voice or typed). No email/SMS ingestion or bank linking in v1. Reminders are scheduled off the manual due dates.

---

## 1. The core monthly loop

### 1a. Recurrence / roll-over (model — see `integrations/supabase.md` `bill_cycles`)
- Every bill is monthly and generates **one `bill_cycle` per month** (period = 1st of month; due_date resolved from `due_day`).
- When a cycle is **marked paid**, or when a new month starts, **generate the next cycle**:
  - **Fixed** bills → next cycle copies the amount automatically.
  - **Variable** bills (electricity, water, anything `kind:"Variable"`) → next cycle starts with **amount = null** and Judith asks **"What's this month's amount for {provider}?"** before it counts toward totals. Until answered, show it as "amount pending" (don't fake a number).
- A scheduled job (`roll-cycles` Edge Function) closes past-due unpaid cycles → `overdue` and creates the upcoming month's cycles.

### 1b. Overdue / missed-bill state (the "let's fix it" moment)
The whole pitch is "no more late fees," so the overdue experience must feel **supportive, not shaming.**
- **Urgency tier `overdue`** = `daysUntilDue < 0`, color `--overdue oklch(0.6 0.23 22)` (deep red). Add this tier everywhere alongside urgent/near/ok.
- **Home — slim overdue strip** (`OverdueStrip`): only renders when something is past due. A thin red-bordered row at the top: red dot + "{provider} · {n}d overdue" (or "{n} bills overdue") + total in `--overdue` + chevron. Tap → bill detail (1) or bills list (many). **Not a big alarming banner — a slim, calm strip.**
- **Bill detail — overdue note** (`BillDetailSheet`): when overdue, show a small in-persona Judith line with her avatar: *"This one slipped past its due date. Pay it now and I'll mark you caught up — no judgment."* The status line reads "{n} days late" in `--overdue`. Primary button label becomes **"Mark paid — catch up"**.
- Seed data includes one overdue bill so this state is visible: **Sky Cable · TV / Streaming · ₱699 · due May 30 · dueDays -2**.

### 1c. Mark-as-paid → proof + history + money-saved
- **"How did you pay?"** chips on the bill detail (optional, tracker-style): **GCash · Bank transfer · Card · Cash**. Selecting one is optional ("I just track it").
- On mark-paid: store `paidVia` + `paidOn`; show a **paid stamp** ("Paid via GCash · Jun 1") and a **"Mark as unpaid"** undo. Recent-payments mini bar chart stays.
- **Money-saved / track record** (proves the ₱0-late-fees promise over time) — see §7.

---

## 2. Payment model — TRACKER (locked)
Build accordingly:
- Bill detail actions are **Mark as paid (+ method) · Snooze · Edit** — never a money-moving "Pay now."
- No payment-rail integrations, no PCI scope. RevenueCat is only for the app's own subscriptions (Ask Judith), not bill payments.
- Copy never implies Judith pays the bill ("I'll remind you," "mark it paid," "caught up" — not "I paid it").

---

## 3. Lifecycle & account  (`AccountScreen` in `japp-extras.jsx`)
Reached from **Settings → account row** (top). Full-screen overlay. Sections:
- **Profile:** avatar initials (e.g. "MR"), name "Maria Reyes", email, country (flag + name). "Edit" pill.
- **Security:** **"Unlock with Face ID"** toggle (biometric/PIN lock — financial data, table stakes) · "Change password" row.
- **Subscription:** "Judith Premium · ₱199 · Lifetime · Active" · "Ask Judith plan" row (Free trial / Judith+ ₱99/mo / Unlimited ₱199/mo → opens paywall) · **"Restore purchases"** row.
- **Your data:** "Export bills & history" (CSV).
- **Danger:** **"Log out"** (→ returns to auth) · **"Delete account"** (red, "Permanently remove your data") — **required by both app stores.**
- **Subscription lapse:** when Judith+/Unlimited lapses, drop the user to the free tier (8-ask trial exhausted → locked Ask + paywall); keep all bill tracking free. Show the current tier honestly in this screen and the Settings Ask row.
- **Resume / "welcome back, continue setup":** onboarding persists `onboarding_step` from the "Before we start" checkpoint on. On relaunch mid-setup, **resume at that step** (not restart). If setup is done, normal app launch.

---

## 4. Empty & error states
- **Home — no bills** (`HomeEmpty`, built): centered Judith avatar + "No bills yet" + "Add your first bill and I'll watch every due date for you — just tell me, or scan one." + **Add a bill** (primary) and **Or just tell Judith** (voice) buttons. Use whenever the user has zero bills.
- **Calendar / Insights — no data:** mirror the same calm empty pattern (avatar + one line + "Add a bill"). Don't render empty charts/grids.
- **Build these error states (spec — match the app's tone, in-persona, never a raw error):**
  - **Voice parse fails:** "I didn't quite catch the {amount/date}. Mind saying it again, or type it?" → fall back to the manual form with whatever was captured pre-filled.
  - **OCR can't read a scan:** "That photo's a little hard to read — try again in better light, or enter it manually." → manual form.
  - **No internet:** non-blocking banner "You're offline — I'll sync when you're back." Bills already loaded stay usable; mark-paid queues and syncs later.
  - **AI (Ask Judith) unavailable:** in-persona "I can't reach my brain right now — try again in a sec," plus the local fallback answers (next due / total / did-I-pay-X). Never a blank crash.
  - **Out of asks mid-conversation:** inline lock card in the thread + route to paywall (see `integrations/revenuecat.md`).

---

## 5. Trust & data (decisions)
- **Due-date source = MANUAL only** (voice or typed) for v1. No email/SMS ingestion, no bank linking. (Documented as a deliberate scope choice; revisit post-launch.)
- **Notifications:** default **3 days before, 9:00 AM**, per-bill lead time editable. Request notification permission **in context** (during reminders setup), not on launch. Quiet-hours + channel (push now; SMS/email later) are post-v1 but leave room in settings.
- **Accessibility:** screen-reader labels on every control, Dynamic Type support, ≥44px targets, respect OS reduce-motion. Voice-first helps but isn't a substitute for labels. Verify text contrast meets WCAG AA in both themes.

---

## 6. International (built — `PROVIDERS_INTL`, `providersFor`, currency-aware money)
- **Currency is country-driven** everywhere money shows. `money(amount, country)` / `peso()` read the symbol from the user's country: **PH ₱ · ID Rp · VN ₫ · MY RM · TH ฿ · MX $ · NG ₦ · IN ₹**. No decimals, thousands-separated, mono font.
- **Per-country LOCAL provider databases** (`PROVIDERS_INTL`) for utilities/telco/banks; **global** providers (Netflix/Spotify/etc.) apply everywhere. Already seeded: **PH** (default), **ID, MY, MX, IN** (electricity/water/internet/mobile/credit-card brands + logo colors + initials). Add VN/TH/NG before launching there.
- **`providersFor(category, country)`** returns local set first, then globals — use it for the add-bill suggestions so a Malaysian user sees TNB/Maybank, not Meralco/BPI.
- **Localized strings by country:** the "comfort-food" joke (PH sinigang · ID rendang · VN pho · MY nasi lemak · TH pad thai · MX tacos · NG jollof · IN biryani) and the "mom" endearment (PH Anak · ID Nak · VN Con · MY Sayang · TH Lûk · MX Mija · NG Dear · IN Beta). **UI stays English; only these tokens + currency + providers localize.**
- **Test the non-PH path:** pick Malaysia in onboarding and verify currency (RM), provider suggestions, the joke ("nasi lemak"), and the endearment ("Sayang") all switch.

---

## 7. Retention (built — `TrackPill` on Home, `RecapScreen`)
- **On-time streak + money saved** — `TRACK_RECORD`: `streak: 7` months, `onTimeRate: 0.98`, `feesAvoided: ₱2,150` (running tally), `paidOnTimeThisYear: 71`, `lateThisYear: 1`.
  - **Home streak pill** (`TrackPill`): one slim line — 🔥 "7-mo on-time streak · ₱2,150 saved" + chevron → opens the Monthly Recap. This is the lightweight, always-visible proof of the ₱0-late-fees promise.
- **Monthly recap — "Your month with Judith"** (`RecapScreen`): reached from the streak pill and **Settings → Monthly recap** row. Contents (`MONTH_RECAP`):
  - Header: Judith avatar (mood "proud") + "Your month with Judith" / "May 2026".
  - **Hero card:** ✓ badge + "Every bill, on time" (or "{onTime} of {billsPaid} on time") + "{billsPaid} bills paid · ₱12,150" + a "₱500 in late fees avoided" chip.
  - **Two stat cards:** "{6}% less than last month" (down = good, green, trend-down icon) + "{7} mo on-time streak 🔥".
  - **Biggest category** row ("Credit card · ₱4,820").
  - **In-persona closing line:** clean month → "Clean month — nothing slipped past me. Keep it going and the streak grows." / a miss → "One got past us. New month, fresh start — I'll stay on it."
- **Household / shared bills:** the multi-house support already exists (bills carry a `house`; Insights has a house filter). Shared-with-another-person bills are post-v1.

---

## Acceptance checklist
- ☐ Overdue tier + color wired everywhere; slim overdue strip on Home (only when late); supportive overdue note + "catch up" button on bill detail; Sky Cable seed shows overdue
- ☐ Mark-paid records method (GCash/Bank/Card/Cash) + paid stamp + undo; variable bills prompt new amount next cycle; cycles roll over
- ☐ No money-moving "Pay now" anywhere (tracker only)
- ☐ Account screen: profile, Face-ID lock, change password, subscription + restore, export, log out, delete account; mid-setup resume works
- ☐ Empty states (home/calendar/insights) + the 5 error states, all in-persona with fallbacks
- ☐ Currency + provider suggestions + food joke + endearment switch by country (test Malaysia)
- ☐ Home streak pill + Monthly Recap screen render with TRACK_RECORD / MONTH_RECAP data

---

## Paste-into-Replit prompt

```
Add the post-setup app features per LIFECYCLE_AND_RETENTION.md. These are designed in the
prototype (source/japp-extras.jsx, japp-bills.jsx BillDetailSheet, japp-home.jsx
OverdueStrip/TrackPill/HomeEmpty, japp-data.jsx TRACK_RECORD/MONTH_RECAP/PROVIDERS_INTL).
Judith is a TRACKER (never moves money) and due dates are entered manually.

Build, pausing after each for review:
1. Monthly loop: bill_cycles roll-over (fixed copies amount; variable prompts "what's this
   month's amount?"); overdue tier+color everywhere; slim Home overdue strip; supportive
   overdue note + "Mark paid — catch up" on bill detail; seed Sky Cable as overdue.
2. Mark-as-paid: "How did you pay?" chips (GCash/Bank/Card/Cash, optional), paid stamp +
   undo, payment history.
3. Account screen (Settings → account row): profile, Face-ID lock, change password,
   subscription + Restore purchases, export data, log out, delete account; resume-setup
   from the saved onboarding step; handle subscription lapse → free tier.
4. Empty states (home/calendar/insights) + in-persona error states (voice-fail, OCR-fail,
   offline, AI-down, out-of-asks) with local fallbacks — never a raw error.
5. International: currency from country everywhere; providersFor(category, country) for
   add-bill suggestions (local DB + globals); localize the food joke + "mom" endearment;
   UI text stays English. Test the Malaysia path.
6. Retention: Home streak pill (🔥 streak + ₱ saved → opens recap) and the "Your month with
   Judith" Monthly Recap screen, using TRACK_RECORD + MONTH_RECAP.

Match the data values and component behavior in the source files exactly.
```
