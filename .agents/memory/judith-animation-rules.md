---
name: Judith animation rules
description: Canonical timing, easing, and font rules for all Judith animations — always check before building any transition or motion
---

# Judith Animation & Transition Rules

**Why:** The user has repeated these corrections multiple times. These are locked design decisions. Always apply them without asking.

## Font usage
- `t.fonts.display` (PlayfairDisplay_800ExtraBold_Italic) — ONLY for the splash "Handled." word and country welcome word stamps. Italic serif = drama + emphasis.
- `t.fonts.bold` (SpaceGrotesk_700Bold) — all other bold headings.
- `t.fonts.regular` / `t.fonts.medium` — body/UI text.
- JetBrains Mono — ALL ₱ amounts (tabular-nums).

## Stamp animations (country welcome word, splash "Handled.")
- Start scale: `2.0` (never lower — needs to feel like it's dropping from above)
- Easing: `Easing.bezier(0.2, 1.6, 0.4, 1)` — strong spring overshoot, snaps back
- Duration: `750ms`
- Opacity: flash in fast (`120ms`) separate from scale
- Stagger between elements: `300ms`
- Subtitle word-up: delay `1800ms`, duration `600ms`, easing `bezier(0.2, 0.8, 0.2, 1)`

## Welcome overlay total timing
- Hold visible: `3400ms` from mount
- Fade out: `500ms`
- Total screen time: ~3.9s

## Bloom / glow background (splash screen)
- Multi-color: teal/mint top-center, purple/violet bottom-right, orange/amber bottom-left
- Each blob: `borderRadius: 9999`, no border, `style={{ filter: [{ blur: Xpx }] }}` (Expo SDK 53+ blur filter) OR use a solid View with `overflow:hidden` + large borderRadius + opacity
- Blur radius per blob: `70–100px`
- Base canvas: near-black `#080c0b`
- Glow opacity: `0.55–0.70` per blob
- The bloom is BEHIND all content (zIndex -1 or rendered first in tree)

## Splash screen spec (locked)
- Background: `#080c0b` (very dark, slight green tint)
- Center: Judith avatar (circular, lavender/blue bg circle)
- Below avatar: "Judith" — large white, `t.fonts.bold`, ~56px
- Tagline: "Due Dates, Handled." — "Due Dates," in `t.txtMid`, "Handled." punches in separately in `t.accent` using `t.fonts.display`
- Floating bill-category chips: Electricity (orange), Internet (purple), Water (blue), Subscriptions (pink) — positioned absolutely, animate in with stagger
- Multi-color bloom behind everything

## Login screen spec (locked)
- Background: dark with subtle teal/green radial gradient (NOT pure black)
- Avatar at top center
- "WELCOME" small caps in `t.accent`
- "Hi, I'm Judith" large bold white (~32px, `t.fonts.bold`)
- Subtitle: "Your bills & due dates — handled, on time, no stress."
- Buttons: Continue with Apple (dark surface), Continue with Google (dark surface + G logo)
- Divider: "or use email"
- Email + Password inputs (dark surface)
- "Log in" CTA: full-width, `t.accent` background, black text, bold
- "New to Judith? Create an account" in `t.accent`

## How to apply
Check this file before writing ANY animation, transition, or splash/login screen code.
Deviating from these specs requires explicit user approval.

## Motion accessibility + haptics (infrastructure)
- `lib/haptics.ts` (light/medium/heavy/success/error/selection) is the only way to fire haptics — native-guarded + promise-safe so it no-ops on web.
- `hooks/useReducedMotion.ts` = OS AccessibilityInfo OR the persisted `reduceMotion` store flag; `hooks/useCountUp.ts` honors it.
- **Haptics are INDEPENDENT of reduce-motion** — keep firing them even when motion is skipped (a calmer-motion user still wants tactile feedback).
- Reduce-motion gating scope: gate NEW/decorative motion (count-ups, stagger, pulse halos/rings, toast slide, home paid-% bar, onboarding sweep). The cinematic onboarding interstitials (stamp, question, latefee, fault, fork commit, vIn entrance) are core narrative and are intentionally NOT gated — gating them is a separate, larger decision needing user sign-off.
