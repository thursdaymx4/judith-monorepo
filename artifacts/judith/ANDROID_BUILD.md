# Judith on Android — build & parity plan

Goal: ship Judith to the **Google Play Store** with the **phone app**, a **home-screen
widget**, and a **Wear OS watch app** — at parity with iOS — while staying easy to
maintain for a non-coder.

This mirrors `watch-app/WATCH_BUILD.md` (the iOS/Apple-Watch plan) for the Android side.

---

## ✅ Status (2026-06-25) — what's built

Phases 1 and 2 are implemented:

- **Phone app (Android) — snapshot + watch hand-off.** `lib/watch.ts` no longer
  returns early on Android. It now uploads the bill snapshot to `/watch-snapshot`
  (so the Wear app can pull `/watch-summary`) **and** hands the payload + a
  server-signed watch token to the paired watch over the Wear Data Layer via a
  new Expo module, `modules/judith-wear-bridge` (the Android analog of iOS
  WatchConnectivity). No-ops cleanly when no watch is paired / in Expo Go.
- **Backend — `POST /api/judith/watch-action`.** Canonical mark-paid / snooze
  write for the standalone Wear app (HMAC watch-token auth, scoped to the
  token's user). Rate-limited via `watchActionLimiter`.
- **Wear OS app — `android-native/wear/`.** A complete, self-contained
  Kotlin/Jetpack Compose Android Studio project at full parity with the Apple
  Watch: home face (paid ring + next bill + streak), Up-next list, bill detail,
  Mark paid + Snooze, paid-confirm, and Ask Judith with voice dictation. See
  `android-native/wear/README.md`.

**Decisions made** (see §3): Wear auth = *phone hands the token over the Data
Layer* (no login on the watch; mirrors iOS). Scope = *full Apple-Watch parity*.

**Data Layer contract** (phone ↔ watch, keep these in sync):
path `/judith/watch-payload`; keys `judith_payload_v2` (payload JSON),
`judith_watch_token` (HMAC bearer), `updated_at` (epoch ms).

**Still to do before shipping:** open `android-native/wear/` in Android Studio
and let it generate the Gradle wrapper; for production, sign the phone app and
the Wear app with the **same** key (required for Data Layer + Play linking);
then run on a Wear emulator paired with the phone app to verify end-to-end.

---

## 0. How the codebase is split (read this first)

You will **not** rebuild the phone app twice. The split is:

| Part | What it is | Where you edit it |
|---|---|---|
| **Phone app** (iOS **and** Android) | Shared React Native / Expo TypeScript | `artifacts/judith` — a code editor (VS Code / Cursor). **Not** Studio/Xcode. |
| iOS widget + Apple Watch | Native SwiftUI | **Xcode** (sources in `targets/` + `watch-app/`) |
| **Android widget + Wear OS watch** | Native Kotlin / Jetpack Compose | **Android Studio** (sources will live in `android-native/`) |

Supabase is the **shared backend / source of truth**. The phone app already uploads a
bill snapshot to it (`/api/judith/watch-snapshot`). Every companion — iOS widget, Apple
Watch, Android widget, Wear OS — reads the *same* data. No device-to-device bridge needed.

> The native `android/` and `ios/` folders are **generated** by `expo prebuild` (they are
> git-ignored). Hand-written native companion code lives in tracked folders (`targets/`
> for iOS, `android-native/` for Android) and is copied into the generated project by a
> config plugin during prebuild. This is how you keep native code in source control.

---

## 1. Current Android readiness (audit result)

✅ Already done in this repo:
- `eas.json` builds Android `app-bundle` and submits to Google Play tracks.
- `app.json` has a complete `android` block (package `com.app.judith`, permissions, adaptive icon).
- All iOS-only native modules no-op safely on Android (`judith-financekit`,
  `judith-widget-bridge`, `judith-receipt-vision`, `react-native-cloud-store`,
  `react-native-watch-connectivity`).
- Receipt scanning falls back to the server pipeline on Android (no Apple Vision needed).
- Google OAuth, RevenueCat Android key, and Play-Store billing copy are wired.

🟡 Phone-app gaps to close (small):
- `lib/watch.ts` → `syncBillsToWatch()` returns early when `Platform.OS !== "ios"`, so on
  Android it currently skips **both** the widget write **and** the `/watch-snapshot`
  backend upload. We need Android to still upload the snapshot (so the Wear OS app + widget
  have data) and write to an Android widget bridge.
- Feature degradation to confirm/accept on Android: no FinanceKit auto-detect (manual entry
  only), no iCloud backup (Supabase covers persistence), on-device OCR → server fallback.

🔴 To build new (native):
- Android home-screen widget.
- Wear OS watch app.

---

## 2. Phased plan

### Phase 1 — Phone app green on Android  *(prerequisite for everything)*
1. `pnpm install` at the repo root.
2. `cd artifacts/judith && npx expo prebuild -p android` to generate `android/`.
3. `npx expo run:android` on an emulator / device; fix any runtime issues.
4. Refactor `lib/watch.ts` so Android uploads the snapshot to the backend + writes the
   widget payload (instead of returning early).
5. Confirm a Google Play internal-track build via `eas build -p android --profile preview`.

### Phase 2 (PRIORITY) — Wear OS watch app  *(native, Android Studio)*
> User priority: the watch app matters more than the home-screen widget. Build this first.

React Native does not target Wear OS, so this is a **separate native Kotlin/Jetpack Compose
app**, living in its own tracked Android Studio project at `android-native/wear/`
(package `com.app.judith`, so Google Play links it to the phone app).

**Architecture — standalone backend client (recommended).** The Apple Watch already runs in
two modes: phone-pushed (WatchConnectivity) and *standalone backend* (a server-signed
`watch-token` → `GET /watch-summary`, `POST /watch-ask`, `POST /watch-stt`). The Wear OS app
will use the **standalone backend mode as its primary path** — it is an independent client of
the same Supabase-backed API. This avoids building a fragile Android phone↔watch Data-Layer
bridge for v1 and works even when the phone is off.

Data flow:
1. Watch signs in (Google → Supabase session) **or** receives a `watch-token` from the phone
   once via the Wear Data Layer (decide in §3).
2. Watch reads bills via `GET /watch-summary` (returns the same `WatchPayload` the iOS watch uses).
3. Watch "Ask Judith" → `POST /watch-ask`; voice dictation → `POST /watch-stt`.
4. **Mark paid / Snooze**: the existing backend has *no* canonical write endpoint (iOS relies
   on the phone for this). We will add a small **`POST /watch-action`** to `api-server` that
   mutates the `bills` table directly using the watch token, so the Wear app is fully standalone.

Screens to match the Apple Watch (`targets/watchos/`): Up-next list → bill detail →
Mark paid / Snooze → paid confirmation; plus a watch-face **Tile / Complication** ("NEXT DUE").

### Phase 3 — Android home-screen widget *(optional / later)*
Deferred — lower priority than the watch. When we get to it:
`react-native-android-widget` (TS, no Kotlin, single codebase) vs native **Glance** (Kotlin).
Render "NEXT DUE · provider · amount · count · total"; read from the same Supabase snapshot.

### Phase 4 — Store readiness
- App icons/splash (already configured), privacy policy, data-safety form, screenshots.
- RevenueCat: confirm `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` + Play Billing products.
- Notifications: confirm `expo-notifications` + FCM (`google-services.json`).
- Submit phone + Wear OS bundles to Google Play (internal → closed → production).

---

## 3. Decisions needed
- **Wear OS auth**: watch signs in independently (Google → Supabase, fully standalone) vs
  phone hands the `watch-token` to the watch via the Wear Data Layer (needs a phone-side
  native module). Recommendation: **independent sign-in** for a simpler, robust v1.
- **Wear OS v1 scope**: lean ("next due" list + Mark paid) first, then add Ask/voice +
  Tile/Complication; or go for full Apple-Watch parity in one pass.
- **Widget tech** (later): `react-native-android-widget` (JS, easy) vs native Glance (Kotlin).
- **Min Android / Wear OS version**: suggest `minSdk 30` (Wear OS 3 / modern Tiles APIs).
