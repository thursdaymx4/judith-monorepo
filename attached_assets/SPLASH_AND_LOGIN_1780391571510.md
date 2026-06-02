# SPLASH_AND_LOGIN.md — fix the intro to match the design

> Replit rebuilt the **Splash** and **Login** screens incorrectly. This file is the **exact, canonical spec** for both. The screens are ONE mounted component (`IntroShell`) so Judith's avatar never unmounts between them. Match these values precisely. Source of truth: `source/japp-splash.jsx` + the CSS in `source/Judith - Full Flow.html` (search `.intro-judith`, `.bloom-bg`, `.float-pill`, `.intro-auth`).

---

## What's wrong right now (from the screenshots)

### Login (image 1) — ❌
- A **giant mint half-circle fills the top ~70%** of the screen. **WRONG.** The mint is NOT a background. The canvas must stay **near-black `#0a0b0e`**. The only mint is the small persona-tinted disc *inside* the avatar circle (≈64–92px) + a soft halo around it.
- Because of that, the dark Apple/Google buttons and email fields sit on a mint slab — they should sit on the **dark canvas**.
- The avatar halo is oversized. It should be a tight glow hugging the avatar, not a screen-filling shape.

### Splash (image 2) — ❌
- The "bloom" background gradients are rendered as **huge opaque orange / purple / mint fields** covering the whole screen and bleeding off-edge. **WRONG.** They must be **subtle (26–30% mix into transparent), heavily feathered (transparent by 70% radius), and blurred 6px** — soft color *glows* on a near-black canvas, not solid shapes.
- Category pills (Electricity / Internet / Water / Subscriptions) are **scattered, oversized, and cut off** at the screen edges. They have **fixed, inset positions** (below) and must sit fully on-screen.
- The **"Judith" wordmark is washed out** behind a blob — it must be crisp, centered, `#f3f5f8`, 44px.
- The avatar is shoved up/off. It must be **horizontally centered** at a fixed vertical position.

---

## Canvas (both stages)
- Background: **`#0a0b0e`** (the app `--canvas`). Never a colored full-bleed.
- Phone screen radius 44px; standard status bar; home indicator at bottom.
- The intro is **one screen** with stages `splash` → `auth`. Judith's avatar is a **single persistent element** that animates between the two positions (do NOT mount two avatars).

---

## SPLASH stage

### Layout (absolute positions, 390×844 reference)
- **Judith avatar:** horizontally centered (`left:50%; translateX(-50%)`), **top: 256px**, size **132px**, state = "listening" (concentric rings). Entrance: `jIn` — fade + scale .5→1 over 1s, ease `cubic-bezier(.2,.8,.2,1)`.
- **Wordmark block:** centered under the avatar.
  - "Judith" — **44px, weight 600, color `#f3f5f8`, letter-spacing -0.02em**. Fades up (`translateY 9→0`) at 0.5s.
  - Tagline "Due Dates, **Handled.**" — 15px, color `--txt-mid`; the word **"Handled."** is `--accent` mint, weight 800.
- **"tap to continue"** footer, low-emphasis, near bottom.

### Bloom background (the decoration that was wrong)
Exactly this — three soft radial glows, feathered + blurred, NOT solid:
```css
.bloom-bg {
  position:absolute; inset:0;
  background:
    radial-gradient(40% 30% at 28% 32%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%),
    radial-gradient(45% 32% at 74% 60%, color-mix(in oklab, oklch(0.78 0.15 330) 28%, transparent), transparent 70%),
    radial-gradient(40% 30% at 52% 78%, color-mix(in oklab, oklch(0.8 0.14 75) 26%, transparent), transparent 70%);
  filter: blur(6px);
  animation: bloomShift 7s ease-in-out infinite alternate; /* scale 1→1.12, translateY 0→-10px */
}
```
> RN note: `color-mix`/`oklch` aren't native. Precompute to rgba at ~26–30% alpha (mint `rgba(110,231,183,0.30)`, pink `rgba(244,166,205,0.28)`, amber `rgba(247,206,130,0.26)`), place as 3 absolutely-positioned blurred radial layers (e.g. `expo-linear-gradient` radial substitute or a blurred PNG), behind everything, on the dark canvas. They should read as **faint colored haze**, never as filled blobs.

### Floating category pills (international — categories, NOT providers)
Four pills, each a small dark glass capsule with a colored icon tile + label. **Fixed inset positions so they never clip:**
```
Electricity (zap,  amber  oklch(0.74 0.16 60))  → top:120px;  left:16px
Internet    (wifi, violet oklch(0.70 0.16 292)) → top:172px;  right:14px
Water       (droplet, blue oklch(0.72 0.13 230))→ bottom:248px; left:20px
Subscriptions (spark, pink oklch(0.74 0.15 330))→ bottom:200px; right:16px
```
Pill style: `display:inline-flex; gap:9px; padding:9px 14px 9px 9px; border-radius:999px; background: surface-2 @ ~82%; 1px hairline; soft shadow + faint accent glow; backdrop-blur 9px;` icon tile 30px rounded with its category color; label 13px/600. Gentle `floatY` (±13px, 5s) loop.

> Keep them **small and fully inside** the frame. They are ambient — not interactive, not full-width, not overlapping the avatar or wordmark.

### Timing
- "Handled." punch-in at **1.9s**: `handledIn` scale/again via `cubic-bezier(.18,1.5,.4,1)`, then a gentle `handledGlow` pulse loop.
- **Haptic** synced to the punch-in (~2.35s) — medium.
- Auto-advance to `auth` at **4.6s** (or on tap). Reduced-motion: skip to end states, advance at ~1.1s.

---

## AUTH (Login) stage

### The avatar moves (shared element — do not remount)
Same avatar animates from splash to the login header:
```
splash:  top:256px; scale:1
auth:    top:92px;  scale:0.7   (transition 'judToAuth' 0.6s cubic-bezier(.4,0,.2,1))
```
The wordmark fades up-and-out (`wordOut`), the bloom + pills fade out (`fadeOut` 0.4s), and the login content fades in.

### Login content (on the DARK canvas — no mint slab)
Centered header, then stacked controls, padded `216px 26px 26px` (the top padding leaves room for the avatar that's now at 92px):
- **Header (centered):** kicker "Welcome" (accent, uppercase, small) · `<h1>` "Hi, I'm Judith" 25px · lede "Your bills & due dates — handled, on time, no stress." 14px `--txt-mid`.
- **Continue with Apple** — full-width **`btn-soft`** (dark `--surface-2` pill, hairline border, white text)  + Apple glyph.
- **Continue with Google** — full-width `btn-soft`, "G" badge in Google blue `#4285F4`.
- **Divider** — hairline with centered "or use email" label.
- **Email field** — `you@email.com` (rounded dark input `.search`).
- **Password field** — `Password`.
- **Log in** — full-width **`btn-primary`** (mint fill, dark text).
- **Foot:** "New to Judith? **Create an account**" (the link in accent).
- A small "Skip for now →" is acceptable at the very bottom.

### Critical visual rules for Login
- **Canvas stays `#0a0b0e`.** No mint background, no giant disc. ✅
- Mint appears only as: the avatar's small tint disc + tight halo, the accent kicker, the "Create an account" link, and the **Log in** button fill.
- Buttons + inputs are **dark pills on dark canvas** with hairline borders — matching the rest of the app.
- Everything fits without the content being pushed off; the form scrolls if needed (hidden scrollbar).

---

## Acceptance (tick before "done")
- ☐ Splash canvas is near-black; blooms are faint blurred glows (not solid orange/purple/mint fields)
- ☐ "Judith" wordmark crisp + centered (`#f3f5f8`, 44px); "Handled." mint, punches in at ~1.9s with haptic
- ☐ 4 category pills small, fully on-screen, at the fixed positions; gentle float
- ☐ Avatar centered at top:256px on splash, animates to top:92px scale .7 on login (same element, no flash)
- ☐ Login canvas is dark — **no mint background slab**; Apple/Google/email are dark pills; Log in is mint
- ☐ Header reads Welcome / "Hi, I'm Judith" / the lede; "Create an account" link in accent
- ☐ Matches `screenshots/00-splash.png` and `screenshots/01-auth.png`

---

## Paste-into-Replit prompt

```
The Splash and Login screens don't match the design — fix them per SPLASH_AND_LOGIN.md.

Two specific bugs to correct:

1) LOGIN: remove the giant mint half-circle/background. The screen canvas must stay
   near-black (#0a0b0e), exactly like the rest of the app. Mint appears ONLY as the small
   tinted disc behind the ~64–92px Judith avatar (with a tight halo), the "Welcome" kicker,
   the "Create an account" link, and the mint "Log in" button. The Apple/Google buttons and
   email/password fields are DARK rounded pills on the dark canvas — not on a mint slab.
   Header: kicker "Welcome", h1 "Hi, I'm Judith", lede "Your bills & due dates — handled,
   on time, no stress." Order: Continue with Apple, Continue with Google, "or use email"
   divider, email field, password field, Log in (mint), "New to Judith? Create an account".

2) SPLASH: the background blooms are rendered as huge opaque color fields — they must be
   SUBTLE. Three soft radial glows (mint, pink, amber) at ~26–30% opacity, feathered to
   transparent by 70% radius, blurred ~6px, on the near-black canvas. They should look like
   faint colored haze, NOT solid blobs. The "Judith" wordmark must be crisp and centered
   (#f3f5f8, 44px); "Handled." is mint and punches in at ~1.9s with a haptic. The four
   category pills (Electricity, Internet, Water, Subscriptions) are SMALL dark glass capsules
   at fixed inset positions (top:120/left:16, top:172/right:14, bottom:248/left:20,
   bottom:200/right:16) — fully on-screen, never clipped, gently floating. Avatar centered
   at top:256px.

The avatar is ONE persistent element that animates from splash (top:256px, scale 1) to login
(top:92px, scale 0.7) — never unmount/remount it (that causes the flash). Match the exact
values in SPLASH_AND_LOGIN.md and the references screenshots/00-splash.png + 01-auth.png.
```
