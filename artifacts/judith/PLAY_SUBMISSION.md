# Judith — Google Play submission guide

Everything needed to ship the **Android phone app** to Play, plus the **Wear
app** follow-up. Items marked **⚠ VERIFY** depend on server behavior / your Play
account and you should confirm before submitting.

Package: `com.app.judith` · Phone version `1.0.1` (versionCode managed remotely
by EAS, `appVersionSource: remote`).

---

## 1. Data Safety form (Play Console → App content → Data safety)

Declare these. Rationale reflects the actual data flows in the code.

| Data type (Play category) | Collected | Shared | Shared with | Purpose | Notes |
|---|---|---|---|---|---|
| **Email address** (Personal info) | Yes | No | — (Supabase = processor) | Account management | Email/password, Google & Apple sign-in (`contexts/AuthContext.tsx`). |
| **Name** (Personal info) | Yes (optional) | No | — | Account management | Only if provided via Apple/Google or onboarding. |
| **Financial info — other** (bills: provider, amount, due dates, category, payment status, income) | Yes | **Yes** | **Anthropic (Claude)** | App functionality (Ask Judith / AI assistant) | Sent only when the user uses AI, which is consent-gated (`lib/aiConsent.ts`). |
| **Purchase history** (Financial info) | Yes | **Yes** | **RevenueCat** | Subscriptions / app functionality | `lib/purchases.ts`. |
| **Photos** (Photos & videos) | Yes | **Yes (on Android)** | **Anthropic (Claude Vision)** | App functionality (receipt scanning) | On Android the on-device OCR module is unavailable, so receipt images go to the server/Claude (`lib/receiptScan.ts` server fallback). On iOS they stay on-device. |
| **Voice or sound recordings** (Audio) | Yes | **Yes** | **ElevenLabs** (transcription) + **Anthropic** | App functionality (voice "Ask Judith") | `RECORD_AUDIO`; gated behind AI consent. |
| **Crash logs / Diagnostics** (App info & performance) | Yes | **Yes** | **Sentry** | App stability / analytics | Disabled in dev; prod only (`app/_layout.tsx`). |
| **Device or other IDs** | ⚠ VERIFY | ⚠ VERIFY | RevenueCat / Sentry | Analytics / functionality | Confirm whether RevenueCat/Sentry collect an advertising/device ID. |

**Security practices to check in the form:**
- ✅ Data is **encrypted in transit** (all calls are HTTPS).
- ✅ Users **can request data deletion** — in-app: Account → Delete Account (`app/account.tsx` → `POST /delete-account`). Provide the same as a URL on your privacy page if asked.
- **Data retention:** the in-app disclosure states third-party AI data is kept **≤ 30 days and not used for training** — **⚠ VERIFY** your server + provider agreements match, and whether audio/photos are processed **ephemerally** (mark "processed ephemerally" only if true).
- This is a finance app but **not** a "financial features" regulated category in the Play sense (it's a tracker, doesn't move money) — answer the content/declaration questions accordingly.

---

## 2. Privacy policy — third‑party AI section (paste into judithforduedates.com/privacy)

> **AI features and third‑party processors.** Judith offers optional AI features —
> "Ask Judith" (voice) and receipt scanning. These features are **off until you
> turn them on** in the app, and you can revoke consent at any time in
> **Settings → AI Features**. When you use them, the following data is sent over an
> encrypted connection to our processors solely to deliver the feature:
> your question (text or transcribed voice), relevant bill details you’ve entered
> (provider, amount, due date, category, payment status), and — on Android — any
> receipt photo you choose to scan.
>
> - **Anthropic, PBC** (the "Claude" AI) — understands your request, generates
>   answers, and reads receipt images for scanning.
> - **ElevenLabs, Inc.** — converts your speech to text and generates spoken
>   replies.
>
> Per our agreements, your data is **not used to train** these providers’ models
> and is retained for **no longer than 30 days**. We also use **Supabase**
> (account, authentication, and bill storage), **RevenueCat** (subscription
> management), and **Sentry** (crash diagnostics). **We do not sell your data.**
> You can delete your account and all associated server data at any time from
> **Account → Delete Account** in the app.

(Keep the wording consistent with the in-app modal in `components/AiConsentModal.tsx`.)

---

## 3. Phone submission runbook (EAS)

```bash
# one-time
npm i -g eas-cli           # or use: npx eas-cli@latest
eas login
cd artifacts/judith

# 0. (optional) sanity check
npx tsc --noEmit -p tsconfig.json

# 1. Build the production AAB. EAS manages the upload keystore (creates it on
#    first run — SAVE IT; you'll reuse it for the Wear app). Output = .aab.
eas build -p android --profile production

# 2a. First-ever submission: create the app in Play Console manually, then
#     upload the .aab from the EAS build page to the *Internal testing* track.
#     (Set up Play App Signing when prompted — let Google manage the app key.)
# 2b. Subsequent submissions can be automated:
eas submit -p android --profile production   # needs a Play service-account JSON
```

**Before the first upload, in Play Console:**
- Accept the Developer agreement; create app "Judith" (category: Finance).
- Set up **Play App Signing** (recommended) — Google holds the app key; EAS’s
  keystore is your **upload** key.
- Complete: **Data Safety** (§1), **Content rating** questionnaire, **App access**
  (provide a test login if sign-in is required to review), **Target audience**,
  **Store listing** (icon, screenshots, short/full description, feature graphic).
- **Foreground service declaration:** the app ships `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
  (voice audio playback via expo-audio) — declare the service type + use case.
- Privacy policy URL: `https://judithforduedates.com/privacy` (must resolve).

**Roll-out:** Internal testing → (optional Closed) → Production.

Versioning: `appVersionSource: remote` means **EAS owns versionCode** — make sure
the remote counter is **ahead of any prior Play upload** (`eas build` bumps it).

---

## 4. Wear OS app — follow-up (defer until phone is live)

The watch ships under the **same package** (`com.app.judith`) as a form-factor
APK in the **same Play app**, signed with the **same upload key**.

```bash
# 1. Get the upload keystore EAS used for the phone:
cd artifacts/judith && eas credentials   # Android → production → download keystore

# 2. Point the Wear release signing at it (do NOT commit the keystore):
#    add to ~/.gradle/gradle.properties
#      JUDITH_WEAR_STORE_FILE=/abs/path/to/upload-keystore.jks
#      JUDITH_WEAR_STORE_PASSWORD=...
#      JUDITH_WEAR_KEY_ALIAS=...
#      JUDITH_WEAR_KEY_PASSWORD=...

# 3. Bump the wear versionCode (android-native/wear/app/build.gradle.kts) to a
#    value UNIQUE within the app and not colliding with the phone's. ⚠ VERIFY.

# 4. Build the release bundle:
cd android-native/wear && ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew :app:bundleRelease
#    -> app/build/outputs/bundle/release/app-release.aab

# 5. Upload to the SAME Play app release (multi-APK by form factor). Play re-signs
#    both with the app signing key, so they match on-device for the Data Layer.
```

Wear status: code is release-ready (targetSdk 35, allowBackup off, release signing
config wired). Minify is intentionally OFF — if you enable it, add
`-keep class com.app.judith.wear.data.** { *; }` (Gson reflection) first.

---

## 5. Pre-submit checklist
- [ ] `eas build -p android --profile production` succeeds (AAB).
- [ ] Data Safety form completed (§1) and matches the in-app disclosure + privacy page.
- [ ] Privacy policy (§2) + Terms live and resolving.
- [ ] Foreground-service type declared.
- [ ] Account-deletion path confirmed working in the built app.
- [ ] Subscriptions show price/period/restore + Terms/Privacy (already in `app/plans.tsx`).
- [ ] Screenshots + listing assets uploaded.
- [ ] Internal testing install smoke-tested, then promote to Production.
- [ ] (Later) Wear AAB built with shared upload key + uploaded to same app.
