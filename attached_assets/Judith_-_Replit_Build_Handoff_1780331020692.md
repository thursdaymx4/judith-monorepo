# Judith — Build Handoff Spec (for Replit)

> **Judith** is a personal due-date assistant. She tracks a user's bills and reminds them before each due date, with a chosen **persona** (voice + personality). Voice-first add-bill, live AI "Ask Judith," reminders, insights, calendar, and device concepts (widgets/Watch). International from day one (8 countries, currency-aware), **UI is always English**.
>
> This document specifies the product exactly as built in the HTML prototype (`Judith - Full Flow.html` + its `*.jsx` files). Build it 1:1. Where the prototype fakes a backend (AI, OCR, TTS), this doc says what to wire to a real service.

---

## 0. How to use this doc + the prototype

- The **source of truth** is the prototype in this project. Open `Judith - Full Flow.html` to click through every screen. Toggle **Tweaks** (top toolbar) to switch layout variants live.
- Each prototype file is a plain-React (no JSX build) module loaded via Babel-standalone. **For Replit, rebuild as a real app** (recommended stack below) — don't ship Babel-in-browser to production.
- Every numeric value, color, copy string, and data shape below is copied verbatim from the prototype. Treat them as canonical.

### Recommended stack on Replit
The original brief targets a later **Expo / React Native** build, and the design is tokenized for that. Two valid paths:
1. **Expo (React Native + Expo Router)** — best match for the brief; real iOS/Android, real push notifications, camera (OCR), widgets/Watch later. Use `nativewind` or a token file for styling.
2. **React (Vite) PWA** — fastest to match the prototype pixel-for-pixel (it's already web). Good for demo/web.

The prototype is structured so the **design tokens, data models, copy, and component list port cleanly to either.** All visual constants are in §2.

---

## 1. Information architecture

```
App
├── Splash  (animated logo → "Judith — Due Dates, Handled.")
├── Auth    (login / create account; social layout)
├── Onboarding (16 steps — see §5)
└── Main app (tab bar)
    ├── Home        (bill timeline + paid-vs-unpaid bar + Judith greeting)
    ├── Calendar    (month grid heat-map + agenda + weekly cash flow)
    ├── Insights    (KPIs, donut, trend, providers; category/provider/house filters)
    └── Settings    (plan, persona, voice, theme, reminders & devices)
    Overlays (full-screen, launched from app):
    ├── Ask Judith   (live AI voice/chat; avatar FAB on Home/Calendar/Insights)
    ├── Reminders    (bell in Home header; lock-screen notif preview + schedule)
    ├── Devices      (Settings → "Preview on your devices"; widgets + Watch concepts)
    ├── Bills list   (Home → "See all"; filters: Category / Provider / Due date)
    └── Bottom sheets: Bill detail · Add/Edit/Scan bill · Plans (paywall)
```

**Tab bar** (always 4 tabs): `Home · Calendar · Insights · Settings`. Icons: `home, cal, chart, gear`. Active tab uses accent color. There is **no** "Ask" or "Bills" tab — Ask is a floating avatar button; Bills are reached via Home's "See all."

---

## 2. Design tokens (canonical)

### 2.1 Color — dark theme (default)
```css
--accent:    oklch(0.78 0.15 168);   /* electric mint-green — THE brand accent */
--canvas:    #0a0b0e;
--surface-1: #121419;
--surface-2: #181b22;
--surface-3: #1f232c;
--hair:      rgba(255,255,255,0.09);  /* 1px borders */
--hair-2:    rgba(255,255,255,0.055);
--txt-hi:    #f3f5f8;
--txt-mid:   #a7adba;
--txt-low:   #6a7180;
/* semantic urgency */
--urgent:    oklch(0.7 0.19 25);      /* red — due ≤3 days */
--near:      oklch(0.82 0.15 80);     /* amber — due ≤7 days */
--ok:        oklch(0.78 0.13 165);    /* green — upcoming / paid */
```

### 2.2 Color — light theme (`data-theme="light"`)
```css
--canvas:#f1f2f6; --surface-1:#ffffff; --surface-2:#fbfbfe; --surface-3:#eceef4;
--hair:rgba(16,18,28,0.10); --hair-2:rgba(16,18,28,0.06);
--txt-hi:#14161d; --txt-mid:#545b6b; --txt-low:#888fa0;
/* accent + semantic colors unchanged. On accent-filled buttons, text is #fff in light, #07080a in dark. */
```
Theme toggled in Settings → Appearance (Dark / Light). Persist the choice.

### 2.3 Three candidate accents (brand picker — green is locked default)
```
mint  oklch(0.78 0.15 168)   ← DEFAULT (use this)
violet oklch(0.74 0.16 295)
blue  oklch(0.72 0.16 245)
```

### 2.4 Category accent palette (for charts/logos, independent of brand accent)
```
Rent / Mortgage  oklch(0.7 0.13 300)      Electricity  oklch(0.74 0.16 60)
Water            oklch(0.72 0.13 230)     Internet     oklch(0.70 0.16 292)
Mobile           oklch(0.75 0.14 165)     Landline     oklch(0.68 0.06 250)
Credit card      oklch(0.68 0.19 22)      Subscription oklch(0.74 0.15 330)
TV / Streaming   oklch(0.74 0.15 330)     Phone subscription oklch(0.72 0.13 200)
Web app          oklch(0.7 0.12 140)      Personal loan oklch(0.68 0.17 30)
Custom           oklch(0.70 0.04 260)
```

### 2.5 Typography
- **UI font:** `Space Grotesk` (weights 400/500/600/700). Characterful grotesk.
- **Numbers / money / dates-as-figures:** `JetBrains Mono` (`.mono`, `font-variant-numeric: tabular-nums; letter-spacing:-0.01em`). **ALL ₱ amounts use the mono face.**
- **Accent display (splash "Handled."):** `Playfair Display` italic 800 — used only for the one hero word.
- Google Fonts import:
  `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,600;1,800&display=swap`
- Never use Inter/Roboto/Arial.

### 2.6 Spacing, radius, shadow
```css
--r-lg:24px; --r-md:16px; --r-sm:12px;   /* card radii */
--pad:18px; --gap:12px;                   /* density "regular"; compact=13/9, comfy=22/15 */
```
- Phone frame: width 390px, screen 368×800, screen radius 44px.
- Card shadow (elevated): `0 14px 34px -12px rgba(0,0,0,.8)` (dark).
- Accent glow on due-soon / orb / avatar: `0 0 12px color-mix(in oklab, <color> 55%, transparent)`.
- Hit targets ≥ 44px. Body text never < 13px on mobile; amounts 15–46px depending on hierarchy.

### 2.7 Motion
- List items: staggered rise-in (`@keyframes rise: translateY(10px)→0`, 0.08s stagger).
- Due-soon cards: subtle accent glow pulse.
- Number count-ups on summary/insights.
- Respect reduced-motion: `body.reduce-motion` disables keyframe animations.

---

## 3. Data models

### 3.1 Bill
```ts
type Bill = {
  id: string;
  provider: string;          // "Meralco"
  cat: Category;             // see categories
  icon: string;              // icon name (zap, droplet, wifi, smartphone, card, home, spark…)
  amount: number;            // 3450  (always whole pesos in UI)
  dueDays: number;           // days until due (0 = today)
  dueDate: number;           // day-of-month (1–31)
  dueLabel: string;          // "Jun 2"
  status: "due" | "paid";
  house?: string;            // "Main home" | "Condo (rental)" | "Parents' house"
  kind?: "Fixed" | "Variable";   // amount type
  subtype?: "Rent" | "Mortgage"; // only for Rent / Mortgage category
};
```

**Seed data (`APP_BILLS`)** — use exactly for the demo account:
```
rent         Ayala Land    Rent / Mortgage  18000  due Jun 1  Main home
meralco      Meralco       Electricity       3450  due Jun 2  Main home
maynilad     Maynilad      Water              890  due Jun 6  Main home
pldt         PLDT Home     Internet          1699  due Jun 6  Main home
globe        Globe         Mobile            1299  due Jun 12 Main home
condo-meralco Meralco      Electricity       1240  due Jun 9  Condo (rental)
condo-dues   Condo Assoc.  Rent / Mortgage   4500  due Jun 14 Condo (rental)
bpi          BPI           Credit card       5200  due Jun 18 Main home
spotify      Spotify       Subscription       194  PAID Jun 25 Main home
netflix      Netflix       Subscription       549  due Jun 28 Main home
```
`HOUSES = ["Main home", "Condo (rental)", "Parents' house"]`

Per-bill history (`HISTORY`) and a 6-month outflow trend (`TREND_6MO`: Jan 11240 → Jun 13281) back the Insights charts.

### 3.2 Categories (onboarding voice groups + manual)
```
Group 0 (Essentials): Rent / Mortgage, Electricity, Water, Internet, Mobile
Group 1 (Subscriptions): Phone subscription (iCloud/Apple Music…), TV / Streaming
                         (Netflix/Disney/HBO…), Web app (Canva/Notion/ChatGPT…)
Group 2 (count-driven): Credit card  (ask "how many?", then loop that many)
Group 3 (count-driven): Personal loan (ask "how many?", then loop)
```

### 3.3 Provider database (`PROVIDERS`) — logos
Each provider has `{ name, color (brand hex), short (logo initials) }`. The app renders a **colored logo tile** with the brand color + initials (`ProviderLogo`). Unknown providers get a stable derived color (hash) + initials.
- **Electricity:** Meralco `#F5821F` M · Visayan Electric `#0a6b3b` VE · Davao Light `#0067b1` DL
- **Water:** Maynilad `#0067B1` M · Manila Water `#00A0AF` MW
- **Internet:** PLDT Home `#C8102E` P · Converge `#F47920` C · Globe At Home `#0066B3` G · Sky Fiber `#E5006D` S · Starlink `#1a1a2e` SL
- **Mobile:** Globe `#0066B3` G · Smart `#00A551` S · DITO `#E5202E` D · TM `#FFB81C` · TNT `#E5202E`
- **Credit card:** BPI `#A6192E` · BDO `#00529C` · Metrobank `#003DA5` · UnionBank `#FF6B00` · RCBC `#003C71` · Security Bank `#006B3F` · Citi `#056DAE`
- **Subscription:** Netflix `#E50914` · Spotify `#1DB954` · YouTube Premium `#FF0000` · Disney+ `#113CCF` · Max `#0046FF` · Prime Video `#00A8E1` · Apple One `#4d4d4f` · iCloud+ `#3b8bea` · Viu `#F8485E` · iWantTFC `#1aa3ff` · Canva `#00C4CC` · Notion `#3f3f3f` · Google One `#4285F4` · Microsoft 365 `#D83B01`

> For production, fetch real brand SVG logos where licensing allows; fall back to the colored-initial tile. Auto-populate: once a user adds a provider under a category, surface it as a suggestion next time (editable).

### 3.4 Personas (`PERSONAS`) — pick one; drives voice + copy + avatar style
```
pro   "Professional peer"  — Clear · calm
funny "Funny friend"       — Warm · playful
sib   "Sarcastic sibling"  — Cheeky · blunt
mama  "Your Mom"           — Caring · a little naggy
```
Greeting lines (shown on persona-pick + Home; English UI):
- **pro:** "I'm Judith. I'll keep your due dates handled — clear, on time, zero stress."
- **funny:** "Hey, I'm Judith! Your personal reminder so no bill ever catches you off guard."
- **sib:** "I'm Judith. I'll remind you about your bills… because we both know you'd forget."
- **mama:** "Sweetheart, it's Judith. I'll handle the bills. You — just make sure you eat well."

### 3.5 Countries (`COUNTRIES`) — currency-aware
```
PH Philippines ₱   ID Indonesia Rp   VN Vietnam ₫   MY Malaysia RM
TH Thailand ฿      MX Mexico $       NG Nigeria ₦   IN India ₹
```
Currency symbol comes from the selected country and is used everywhere money appears.
**Country-aware comfort food** (drives the "Judith only talks bills" joke):
`PH sinigang · ID rendang · VN pho · MY nasi lemak · TH pad thai · MX tacos · NG jollof rice · IN biryani`
**Country-aware "Mom" endearment** (sarcastic/mama copy): `PH Anak · ID Nak · VN Con · MY Sayang · TH Lûk · MX Mija · NG Dear · IN Beta`

### 3.6 Voices (`VOICES`) — ElevenLabs (Settings → Voice)
`Rachel (Warm·natural, Default) · Antoni (Calm·confident) · Bella (Soft·friendly) · Domi (Bold·energetic) · Elli (Bright·youthful)`
**Voice rule:** Judith always *speaks* in **English**, in the chosen voice — even when bills are local. Only the spoken layer is English-only; the visual layer shows ₱ + local provider names normally.

---

## 4. Pricing (locked)

- **App access: ₱199 one-time (lifetime).** The user has already purchased before onboarding's app section, so **no paywall during onboarding's setup** — but the **Ask Judith** feature is metered separately:
- **Free trial:** 8 free "asks" to start.
- **Ask Judith subscription (consumable, two tiers):**
  - **Judith+ — ₱99/mo** → 50 voice asks per month.
  - **Judith Unlimited — ₱199/mo** → unlimited asks (tagged "Best value").
  - Both: **fair-use cap of 10 asks/hour.** Bill tracking + reminders are always free.
- **Off-topic guard (brand joke):** Judith only answers about the user's bills. "Ask her for a {countryFood} recipe and she'll politely send you back to your due dates. 🍲🚫"
- Paywall appears: (a) after the 3 Ask-Judith demo screens in onboarding, (b) Settings → Ask Judith row, (c) when free asks hit 0. Selecting a tier updates the CTA ("Start Judith+ · ₱99/mo"); a "Continue with 8 free asks" opt-out exists in onboarding.

---

## 5. Onboarding — 16 steps (exact order)

`FLOW = welcome → country → language → persona → latefee → problem → stakes → intro → voice → congrats → personalizing → summary → feature1 → feature2 → feature3 → askpaywall → (app)`

- **Save point / resume:** from step `intro` onward, persist the step index (`judith_onb_idx`) so closing the app resumes here, not from the start. Steps before `intro` always restart. `welcome` & `personalizing` have no back button. `country` & `persona` are skippable.

**Step-by-step:**

1. **welcome — "Meet Judith"** — Judith avatar (friendly expression, not the orb), headline "Your bills, handled — before they're ever late." Sub: "Judith tracks every due date and reminds you in your own voice, your own language." CTA **"Let's begin"**.
   - *Interstitial → step 2:* **sweep** — the "Let's begin" button slides to center, a light-sweep reveals the next screen. (LOCKED)
2. **country — "Where do you live?"** — searchable country list with flags; sets currency + provider set + due-date norms.
   - *Interstitial → step 3:* **stamp** — a country-familiar word stamps in (e.g. PH "Mabuhay"/"Tara!") with a voiceover of that word. (LOCKED)
3. **language — "What language should Judith speak?"** — Judith speaks a sample on tap ("Tap to hear me in any language") with a **pulse** micro-interaction. Wire tap → ElevenLabs TTS keyed by language+voice. (Note: the UI itself stays English; this only sets her spoken language.)
4. **persona — "Who should Judith be?"** — 2×2 grid of the 4 persona cards, each with the avatar in that persona's **style** (same Aqua Judith — short-haired woman — different clothes/angle/expression per persona, NOT different people). "Play voice" affordance plays the greeting line. On select, show the persona's sample line.
5. **latefee (hook) — staging the problem** — a mock **late-payment-fee notification** dropping in ("Late payment fee · −₱500 · Posted to your account"), persona-tailored headline. Headlines per persona, country-aware:
   - pro (default): "Missed a bill unintentionally — and paid for it?"
   - sib: "Missed a bill… **again**?" ("again" in red)
   - mama: "{endearment}, missed a bill and paid extra?" (endearment country-aware)
   - "paid" styled red + underlined.
   - *Interstitial → next:* a **dramatic failure transition** (red line + shake) with a **strong haptic**. (This is the "denotes failure" transition.)
6. **problem — "Quick question"** — asks whether they know their total bills due next month; presents a **choice** (I know / I don't) and **records it for benchmarking**. Shows a long line-item list (Netflix, Spotify, + many small subs) to emphasize how the list piles up.
   - *Interstitial → next:* **question-mark bubbles** that float up the **full height** of the screen.
7. **stakes (the fork) — "What if you keep going this way?"** — title at top; a **left / right** split (not top/bottom): left = red "keep going" box (trend arrow pointing **down**, more fees), right = green "Start today" box (✓, ₱0 in late fees). A face under each box: **anxious** under red, **calm/in-control** under green. CTA "No, let's fix this."
   - *Commit transition (the big one):* on "No, let's fix this", the **green "Start today" card zooms to center, holds ~2s, then flips** to a card reading "You will start taking control **today**." — "You" is bigger, on its own line, different color, delayed; "control" different font + shake; "today" with underline animation. End with a **2-second pause** before continuing so the user internalizes "today!".
8. **intro — "How Judith works"** (= **expectations + save point**) — Judith starts talking. Short copy: "Do you have 5–7 minutes now so we can map your whole bill picture?" Sub: "More bills than most? It may take a little longer — worth it." (Rest carried by canned voice.) This is the resume checkpoint.
9. **voice — "Tell Judith your bills"** — THE core voice-first test. See §6 (detailed).
10. **congrats — "All set."** — avatar (joyful), "Judith now watches every due date for you."
11. **personalizing** — fake loading: "Reading your bills… → Setting smart reminders… → Tuning Judith's voice… → Almost ready…"
12. **summary — "Your money, this month"** — totals + bar chart (each bar labeled with its ₱ value), insight rows: **Biggest bill**, **Biggest category** (name · % of total · amount), **Next due**. The whole money picture.
13–15. **feature1/2/3 — three "Ask Judith" voice demos** (calm avatar + transcript bubbles). Three distinct questions:
   - F1: "Judith, what's my total credit card bill next month?" → "₱8,300 across BPI and BDO — both due before the 25th. Want a heads-up?"
   - F2: "Judith, which bills are due this week?" → "Three — Meralco, PLDT and your condo dues. ₱5,830 total. Want me to remind you the day before each?"
   - F3: "Judith, I've got ₱30,000 left this month — can I afford ₱5,000 for a trip this week?" → "You can, but keep it tight — ₱8,800 is due by Friday. After the trip you'd have ₱16,200 to cover the rest. Go, just don't touch the bill money."
16. **askpaywall** — "You've got 8 free asks to start" + the two-tier plan picker (§4) + "Continue with 8 free asks." → enters the app.

> **Locked interstitials (do not change):** "Let's begin" reveal = **sweep**; country greeting = **stamp**; hook screen = **alert**/failure transition.

---

## 6. Voice add-bill flow (onboarding step 9 — the signature interaction)

**Principle: voice-first, tap-second.** Judith asks for each bill by voice; the user speaks naturally; answers are parsed into Provider / Amount / Due date and shown for confirmation. A "Type instead" path opens a manual category grid + form.

**Sequence (exhaustive — keep asking until the picture is complete):**
1. **Essentials (group 0), scripted, one at a time:** Rent/Mortgage (asked first — "the big one"), Electricity, Water, Internet, Mobile. For each: Judith prompt → mic (listening) → parsed card showing **Provider · Amount · Type(Fixed/Variable) · Category(+subtype for rent)** with the provider logo → confirm / "I don't have this →" (skip) / "Type instead."
2. **Breather + save point** after essentials: shows the logged essentials with a **running total** ("Add a utility" or "Keep going"). Only **two** CTAs on every breather.
3. **Subscriptions (group 1):** Phone subscriptions (iCloud, Apple Music…), then TV/Streaming (Netflix, Disney, HBO…), then Web apps (Canva, Notion…). Each item offers "I don't have this →."
4. **Breather + save point** after subscriptions.
5. **Credit cards (group 2 — count-driven):** Judith first asks **"How many credit cards do you have?"** (chips: None/1/2/3/4/5+). Then loops exactly that many ("Card 1 of N", "Card 2 of N"). None → skip section.
6. **Loans (group 3 — count-driven):** "How many loans?" → loops that many (personal/car/housing).
7. **"Anything else?"** — option to add MORE bills before the picture, to fully exhaust.
8. Final → "That's everything — utilities, subscriptions, cards and loans. Now you can see the whole picture."

**Parsed card fields** (half-width split to save space): **Type (Fixed/Variable)** and **Category** share one row; Rent/Mortgage shows a Rent vs Mortgage subtype. Multi-house users get a "Which home?" selector in the manual form.

**Manual form** (`Type instead` / edit): Provider (with auto-suggested learned + DB providers), Amount (with currency prefix), Due date, **Category select + Type segmented (Fixed/Variable) on one half/half row**, Rent/Mortgage subtype toggle when relevant, "Which home?" chips when >1 house.

> **Wire to real services:** speech-to-text (e.g. native speech / Whisper) for capture; an NLU/Claude call to extract `{provider, amount, dueDate, category}` from the utterance; ElevenLabs for Judith's spoken prompts. Flag low-confidence fields for review (see scan flow §8).

---

## 7. Main app screens

### 7.1 Home (`homeStyle` default = **timeline**)
- **Header:** Judith avatar + a **comic speech bubble** summarizing the account ("6 bills this month / 3 due this week"), aligned to the chosen avatar. A **bell button** (right) with an urgent-count badge opens **Reminders**.
- **Stat duo card:** "due this month" (total) | "next 7 days" (sum, amber).
- **Paid-vs-unpaid bar:** % paid + counts/amounts (green fill, glow).
- **Timeline:** vertical rail of upcoming bills (node colored by urgency, day-of-month, provider logo, amount). "See all · N" → Bills list.
- 5 layout variants exist (`focus, ring, hero, summary, timeline`) — **ship `timeline`.** Others are alternates in Tweaks.

### 7.2 Calendar (`calStyle` default = **heat**)
- Month grid **heat-map** (Rocket-Money-inspired): each day tinted by amount due, provider logos on bill days, tap a day → agenda. Selectable day detail.
- **Weekly cash flow** below: bars per week with **year-aware date ranges** (computed from real month length — e.g. June 2026 → 1–7, 8–14, 15–21, 22–28, 29–30). A 31-day month or 28-day Feb generates correct ranges automatically.
- Legend explains the heat scale.

### 7.3 Insights (`insightsStyle` default = **overview**)
- KPIs, **donut** by category, 6-month **trend** line, top providers. Amounts in mono.
- **Filters (compact, low real-estate):** date range segmented (1M/3M/6M/1Y) + chips for **Category**, **Provider**, and **House** (the house chip only appears when >1 house). Selecting a house re-scopes every chart/total to that house. Provider list is scoped to the chosen category.
- **No calendar here** (Calendar is its own tab).

### 7.4 Settings
- **Plan card:** "Judith Premium · ₱199 · Lifetime · Active."
- **Ask Judith row:** shows free asks left / active tier (Judith+ 50/mo or Unlimited); tap → paywall.
- **Appearance:** Dark / Light toggle (one tap).
- **Judith's personality:** 4 personas (radio).
- **Voice · powered by ElevenLabs:** 5 voices (radio) + note about English-only speech.
- **Reminders & devices:** toggles — Due-date reminders, Home-screen widget, Apple Watch, Payment nudges. Plus **"Preview on your devices"** → Devices showcase.
- Footer: version + "Restart demo."

---

## 8. Scan a bill (`scanStyle` LOCKED = **confirm**)

Entry: scan FAB (⊡) on Calendar/Bills, or the Scan toggle in the Add-bill sheet.

**Confirm flow (Splitwise-inspired) — the locked default:**
1. **Capture:** dark viewfinder with corner guides, shutter, flash, keyboard (manual) buttons. Tap shutter → "Reading your bill…" sweep animation (~1.9s).
2. **Confirm card:** "Confirm bill" with a "Judith read this — fix anything that's off" banner. A 2×2 grid of **editable** fields: Provider, Amount (currency prefix), **Due date (flagged "check this" when low-confidence)**, Category (select). A mini receipt thumbnail + "Rescan." CTA **"Add this bill."**

> Two alternate flows exist in code (`live` = Brex real-time floating detect card; `receipt` = GoPay receipt-thumbnail + extracted rows with caution highlights) — keep them behind a flag but **ship `confirm`.**
> **Wire to real OCR:** on-device document scanning / a receipt-OCR service → extract `{provider, amount, dueDate, category}`, attach a confidence per field, and visually flag any field below threshold (amber "check this"). Let the user correct inline before saving.

---

## 9. Ask Judith (live AI)

- Launched by the **avatar FAB** (Home/Calendar/Insights). Full-screen overlay.
- **Empty state:** big avatar + persona greeting line + "X asks left / Ask as much as you like."
- **Conversation:** user bubbles (right), Judith bubbles (left, with small avatar). Typing indicator while thinking. Quick-ask chips (`What's due this week? · How much do I owe this month? · Did I pay Meralco? · What's my biggest bill? · When's my next due date?`). Text input + mic button.
- **Metering:** each answer consumes one ask (unless Unlimited). Pill turns **amber** at ≤3 left. At 0 (non-subscriber): a **locked state** (avatar+badge, "You're out of free asks", plans CTA) replaces the input; an inline lock card appears mid-conversation when the last ask is spent.
- **Off-topic deflection:** Judith refuses non-bill questions in-character and steers back (the food joke). The system prompt must hard-restrict scope to the user's bills/dates/totals/payments.

**Wire to real AI:** send a system prompt with the persona tone + today's date + the user's bills + currency + the country food (for deflection), and the user's question. Keep replies to 1–3 spoken-style sentences, money as the currency symbol with no decimals, English only. Prototype builds this prompt in `japp-ask.jsx` → `buildPrompt()` — copy its structure. Provide an offline fallback (next-due answer, or persona deflection for off-topic).

---

## 10. Reminders (notifications)

- **Entry:** bell in Home header (urgent-count badge).
- **Lock-screen notification preview (hero):** a realistic iOS lock-screen push from Judith for the most urgent unpaid bill, with **persona + country-flavored copy** and two inline actions: **Pay now** (marks paid, advances to next reminder) and **Remind tomorrow** (snooze +1 day). Example titles by persona:
  - pro: "{provider} due in {n} days" / "₱{amt} — a good time to clear it before it's late."
  - funny: "Heads up — {provider} 👀" / "₱{amt} due in {n} days. Let's not gift them late-fee money, okay?"
  - sib: "{provider} again." / "₱{amt}, due in {n} days. Pay it before I have to remind you twice."
  - mama: "{endearment}, {provider} is due in {n}" / "₱{amt} na lang. Bayaran mo na para wala tayong problema, ha?"
- **Scheduled list:** grouped Sending soon / This week / Later this month; each row shows the reminder fire time ("Reminder Jun 6 · 9:00 AM", default **3 days before, 9:00 AM**) + amount + due date; tap → bill detail.
- Respects the Settings reminders toggle (shows an "off" notice that deep-links to Settings).

> **Wire real push:** schedule local/push notifications `leadDays` before each `dueDate` at the user's reminder time; notification actions Pay/Snooze map to the same handlers.

---

## 11. Devices showcase (concepts — Settings → "Preview on your devices")

Visual concepts for planned features; pull live data (next due, totals, urgency colors), Judith tokens, persona avatar.
- **Home Screen:** wallpaper mock with a **small widget** (avatar + Next due provider + amount + days) and a **medium widget** (total due this month + next 3 bills + upcoming count + avatar), above an app dock.
- **Lock Screen:** three **circular complications** (Judith avatar, due-count ring, month-total) + an inline **rectangular widget** under the clock ("Meralco due in 3 days · ₱3,450 · tap to pay").
- **Apple Watch:** two watch frames — a **face** (monthly total + next-due complication) and a **watch app** card (avatar + next bill + **Pay now**).

---

## 12. Bill detail & list

- **Bill detail sheet:** logo, provider, amount, category, due; reminder row ("3 days before · 9:00 AM"); actions **Pay now (markPaid)**, **Snooze (+1 day)**, **Edit**.
- **Bills list** (Home → "See all"): every bill as a line item with filters for **Category, Provider, Due date**.
- **State handlers** (names from prototype `ctx`): `markPaid(id)`, `markUnpaid(id)`, `snooze(id)`, `saveBill(bill)`, `addBill`, plus toasts ("Marked as paid ✓", "Snoozed — I'll remind you tomorrow", "Bill saved ✓").

---

## 13. Avatar system (Judith's face)

- Judith is a **female persona** visible across the app — **the same person** (locked look: **"Aqua" / modern, short-haired woman**), restyled per persona (clothes/expression/angle), never a different face.
- Prototype generates her via **DiceBear** (`micah` style, seed `Amaya`, gradient backdrop) with per-persona param overrides + mood expressions (`joy/warm/proud/wink/gentle`) and pose transforms. States: `idle / listening / speaking`.
- **For production:** commission/produce a consistent illustrated character set — one base Judith, 4 persona styles × a few expressions/poses, plus listening/speaking states. Keep the friendly, colorful, bright feel. The avatar replaces any generic mic/orb everywhere.

---

## 14. Splash + Auth

- **Splash:** animated logo; tagline **"Judith — Your Personal Due Dates Assistant"** then settles to **"Judith: Due Dates, Handled."** The word **"Handled."** punches in from the front (zoom from large/blur → springy overshoot → settle with accent glow), delayed, with a **haptic** synced to the punch-in. Splash shows **bill-category** motifs (international), not PH-specific providers. Judith's face **persists smoothly** from splash into the login/create-account screen (no flash/disappear).
- **Auth:** social-login layout (kept). Judith avatar must not overlap the "Welcome" text.

---

## 15. Persistence / state keys (prototype)

- `judith_onb_idx` — onboarding resume index (from `intro` onward).
- `judith_country` — selected country code (so currency + food joke persist into the app).
- `judith_phase` — splash/auth/onboarding/app (demo router).
- App state (React): bills, asks (default 8), subscribed, tier (null/"plus"/"pro"), persona, voiceId, toggles `{reminders, widget, watch, autopay}`, theme.
- Production: persist user profile (country, persona, voice, theme), bills, plan/asks, reminder settings, and the onboarding benchmark answer (step 6).

---

## 16. Localization rules (important)

- **UI text is ALL English** (do not localize the interface). The earlier Taglish/Filipino UI was removed.
- **Localized by country:** currency symbol, provider sets, the comfort-food joke, the "mom" endearment, due-date norms.
- **Spoken voice** (ElevenLabs) is **always English**, in the chosen voice, regardless of country.
- Keep money as `<symbol><amount>` with no decimals, thousands-separated (e.g. ₱3,450), in the mono face. Dates display normally ("Jun 2").

---

## 17. Prototype file map (read these for exact code)

| File | What it contains |
|---|---|
| `Judith - Full Flow.html` | All CSS tokens + every screen's styles; loads all JSX; **start here** |
| `j-core.jsx` | Icons, personas, languages, countries, country-food, i18n strings, helpers |
| `japp-data.jsx` | Bills seed, provider DB + logos, category colors/icons, voices, quick-asks, `peso()`, `dueClass()` |
| `japp-avatar.jsx` | Judith avatar component, persona styles, moods/poses |
| `japp-flow.jsx` | Demo router, Tweaks defaults (accent, styles), global var application |
| `japp-onboarding.jsx` | Onboarding FLOW order, save point, transitions wiring |
| `j-screens-a/b/c/d.jsx` | Onboarding screens (a: welcome/country/language/persona; b: voice add-bill; c: congrats/personalizing/summary; d: features/paywall) |
| `japp-home.jsx` | Home tab (5 layout variants) + paid bar |
| `japp-calendar.jsx` | Calendar tab (heat/grid/rail) + weekly cash flow |
| `japp-insights.jsx` | Insights tab + filters (category/provider/house) |
| `japp-bills.jsx` | Bills list, bill detail sheet, add/edit/scan sheet (3 scan flows) |
| `japp-ask.jsx` | Ask Judith live AI (prompt builder, metering, deflection, lock states) |
| `japp-reminders.jsx` | Reminders overlay (lock-screen preview + schedule) |
| `japp-devices.jsx` | Widgets + Apple Watch concept frames |
| `japp-settings.jsx` | Settings tab |
| `japp-appshell.jsx` | Tab bar, overlays, all state + handlers (`markPaid`, `snooze`, `saveBill`, `subscribe`, etc.) |
| `japp-splash.jsx` / `japp-auth.jsx` | Splash animation + auth |

---

## 18. Integration checklist (what to wire on Replit)

| Faked in prototype | Wire to |
|---|---|
| Judith's spoken prompts & samples | **ElevenLabs TTS** (voice = chosen `VOICES` id; English text) |
| Voice add-bill capture | Speech-to-text + NLU/Claude to extract `{provider, amount, dueDate, category}` |
| Ask Judith answers | **Claude** (system prompt per `buildPrompt`, bill context, scope-locked) |
| Bill scan | Receipt **OCR** + field confidence; flag low-confidence for review |
| Reminders | **Local/push notifications** scheduled `leadDays` before due, with Pay/Snooze actions |
| Provider logos | Real brand logos where licensed; colored-initial tile fallback |
| Widgets / Watch | iOS WidgetKit + watchOS (post-MVP; concepts in §11) |
| Auth | Real auth provider (social layout) |
| Persistence | DB for profile, bills, plan/asks, reminder settings, benchmark answer |

---

*End of spec. For anything ambiguous, click the exact screen in `Judith - Full Flow.html` and match it — the prototype is canonical.*
