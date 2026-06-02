# MOTION_AND_TRANSITIONS.md — in-between screens, animations & interactions

> **Why this file exists:** these moments live *between* the numbered screens, so a code agent that builds "screen by screen" skips them. They are **first-class deliverables**, not polish. Build them with the same priority as the screens. In React Native use **Reanimated** (`withTiming`, `withSequence`, `withDelay`, `withSpring`) for motion and **expo-haptics** for the haptics. Timings below are the intended feel — tune ±20% on device.

Source of truth for logic: `source/japp-interstitial.jsx`, `source/japp-splash.jsx`, `source/japp-onboarding.jsx`, `source/j-screens-b.jsx`.

---

## A. LOCKED interstitials (do not redesign — only re-implement)

### A1. "Let's begin" reveal = **SWEEP**  (Meet Judith → Step 1 Country)
- **Trigger:** tap "Let's begin" on screen `01-onboarding-meet-judith`.
- **Sequence:**
  1. Everything except the "Let's begin" button fades out (~250ms).
  2. The button **translates to the exact center** of the screen and becomes the only element (~450ms, ease-out).
  3. A **light sweep** (a soft diagonal highlight band) wipes across left→right over the button (~600ms) and, as it passes, **reveals the Country screen** beneath it (the sweep acts as a mask/wipe).
  4. Country screen settles; button is gone.
- **Total:** ~1.3s. **Haptic:** light tap when the sweep starts.
- **RN:** animate button `translateX/Y` to center; overlay a `LinearGradient` band translating across with `withTiming`; cross-fade the next route in behind it.

### A2. Country greeting = **STAMP**  (Country → Step 3, after picking a country)
- **Trigger:** selecting a country (e.g. Philippines).
- **What shows:** a full-screen interstitial with a **country-familiar word** that **stamps in** — PH: "Mabuhay" / "Tara!", and the country-appropriate word for others (keep a per-country map). 
- **Sequence:** word starts large + slightly rotated + transparent → **slams to final size** with a spring overshoot (~350ms) like a rubber stamp, tiny screen shake on impact; hold ~900ms; fade out (~300ms) into the next screen.
- **Audio:** play a **voiceover of that word** (ElevenLabs, country language) synced to the stamp impact.
- **Haptic:** medium impact on the stamp.
- **RN:** `withSequence(withTiming(scale 1.4→0.95, 250), withSpring(1, {damping:6}))`; trigger `Haptics.impactAsync(Medium)` + audio at the spring start.

### A3. Hook screen = **ALERT / failure transition**  (Persona → Late-payment-fee screen)
- **Trigger:** after persona pick, entering the late-fee hook.
- **Feel:** must **denote failure** — dramatic and emphatic (this stages the problem).
- **Sequence:** a hard **red line** slices across the screen + a sharp **screen shake** (3–4 quick horizontal jitters, ~400ms), screen flashes to the late-fee state.
- **Haptic:** **strong** impact (`Haptics.notificationAsync(Error)` or heavy impact), synced to the red line.
- **RN:** shake = `withSequence` of small `translateX` (+8,-8,+5,-3,0); red line = a thin view scaling its width 0→100% fast then fading.

> These three are **locked**: sweep / stamp / alert. Don't substitute cross-dissolves or other transitions here.

---

## B. Other onboarding transitions

### B1. Question-mark bubble  (Late-fee → "Do you know your total bills next month?")
- Many **"?" glyphs bubble up** from the bottom and float **all the way to the top** of the screen (full height), varied sizes/opacity/speed, then the question screen settles in.
- ~1.2s; stagger the spawns. Light haptic optional.
- **RN:** spawn N `Text "?"` with random x, animate `translateY` from screenHeight→ -40 with varied durations + fade.

### B2. The fork commit = **ZOOM → FLIP → emphasis → hold**  (Fork → "How Judith works")
This is the most important transition. On tap of **"No, let's fix this"**:
1. The green **"Start Today" card** (the ✓ / ₱0-in-late-fees box) **zooms to the center** of the screen and **holds there ~2s** (let it breathe).
2. The card **flips** (3D rotateY) to reveal a new card: **"You will start taking control today."**
3. **Word emphasis / timing on the back card:**
   - **"You"** — bigger, on **its own line**, a different color, appears first with a short delay.
   - **"control"** — different font, with a **shake**.
   - **"today"** — **underline animation** draws in; this is the payoff word.
   - Stagger these so the user reads You → … → control → today.
4. **Hold ~2 seconds** on "today!" so it lands, **then** transition to the "How Judith works" / expectations screen.
- **Haptics:** soft tick on the flip; a slightly stronger one as "today" underlines.
- **RN:** `rotateY` 0→180deg flip with `withTiming`; per-word `withDelay` + `withSpring`; underline = a view scaling `scaleX` 0→1; gate the next navigation behind a 2s `setTimeout`/`withDelay`.

---

## C. Micro-interactions (per screen)

- **Splash "Handled." punch-in:** the word "Handled." enters from large + blurred → springy overshoot → settles with an accent glow; **delayed ~1.9s** after the wordmark; **haptic** synced to the punch-in (~2.35s). Splash auto-advances to Login (~4.6s) or on tap. Judith's face **persists** splash→login (shared element — same avatar node animates position/size, no unmount).
- **Language "tap to hear me":** tapping triggers a **pulse** (concentric ring expands from the button, ~600ms) + plays the ElevenLabs sample. Repeat on each tap.
- **Persona cards:** each card has a **play-voice** affordance that previews the persona's greeting line; selected card lifts/highlights.
- **Voice add-bill (Step 9):** mic has a **listening state** (expanding rings / waveform); on "parse," the result card **bubble-ins** (translateY+fade) and the recognized tokens (provider/amount/date) highlight in sequence; count-driven prompts update ("Card 1 of 3").
- **Mark-as-paid / actions:** button press scale-down (0.96) + success toast slides up.

## D. Global motion (every list/number)
- **Staggered list reveal:** items rise-in (`translateY 10→0` + fade), ~80ms stagger.
- **Due-soon glow:** urgent/overdue cards have a subtle pulsing accent glow.
- **Number count-ups:** totals (summary, insights, home hero) count from 0 → value (~600–900ms, ease-out) on first appearance.
- **Reduced motion:** a setting disables all non-essential animation (instant states). Respect OS "Reduce Motion" too.

---

## E. Implementation notes for React Native
- Library: **react-native-reanimated** (v3) for all of the above; **react-native-gesture-handler** if needed; **expo-haptics** for haptics; **expo-av** for the stamp/sample audio.
- **Shared-element persistence** (splash→login Judith, card zoom→flip): use a single persistent component whose style animates, or `react-native-shared-element` / a Reanimated layout transition — do **not** unmount/remount the avatar between the two states (that causes the "disappear" flash the prototype specifically fixed).
- **Sequencing:** build each interstitial as a small self-contained component that runs its timeline on mount and calls `onDone()` to navigate. Gate navigation behind the full timeline (incl. the deliberate 2s holds) — don't navigate early.
- **Haptics map:** light tap = `impactAsync(Light)`; stamp = `impactAsync(Medium)`; failure/alert = `notificationAsync(Error)` or `impactAsync(Heavy)`; "today" underline = `impactAsync(Medium)`.
- **Don't transcribe CSS easings 1:1** — re-feel with `withTiming`/`withSpring`. The *sequence, timing rhythm, and haptics* matter more than exact curves.

---

## Paste-into-Claude-Code prompt

```
The onboarding "in-between" screens, animations, and micro-interactions were skipped.
Read MOTION_AND_TRANSITIONS.md and implement ALL of them as first-class features using
react-native-reanimated + expo-haptics + expo-av. They are not optional polish.

Build each as a self-contained interstitial component that runs its timeline on mount and
calls onDone() to navigate — gate navigation behind the full timeline, including the
deliberate holds.

Implement, in order, and show me each running before moving on:
1. SWEEP — "Let's begin" recenters then a light-sweep wipes in the Country screen (haptic)
2. STAMP — country word ("Mabuhay"/"Tara!") stamps in with spring overshoot + voiceover + medium haptic
3. ALERT — red line + screen shake + strong haptic into the late-fee hook (must feel like failure)
4. QUESTION-MARKS — "?" glyphs bubble bottom→top full height into the "do you know your total?" screen
5. FORK COMMIT — green "Start Today" card zooms to center, holds 2s, flips to
   "You will start taking control today" with You (own line, bigger, recolored), control
   (different font + shake), today (underline draw), then hold 2s before the next screen
6. Micro-interactions: splash "Handled." punch-in + haptic + persistent avatar into Login;
   language "tap to hear me" pulse; persona play-voice; voice add-bill listening + parsed
   bubble-in; list stagger-rise; number count-ups; reduced-motion support

Locked transitions — do not substitute: begin=sweep, country=stamp, hook=alert.
Reference exact behavior in source/japp-interstitial.jsx, japp-splash.jsx, japp-onboarding.jsx.
```
