# Judith for Wear OS

A Wear OS (Kotlin + Jetpack Compose) recreation of the Judith Apple Watch app —
a bill due-date tracker. The watch shows your paid-progress, what's due next, and
lets you mark bills paid, snooze, or ask "Judith" about your bills by voice.

There is **no login on the watch.** The paired Android phone pushes your data and
an auth token to the watch over the Wear Data Layer. The watch then uses that
token to talk to the backend directly.

---

## Opening in Android Studio

1. Open Android Studio (Ladybug / 2024.2 or newer).
2. **File → Open…** and select this folder: `android-native/wear`.
3. Let Gradle sync. The first sync downloads dependencies — give it a minute.

### About the Gradle wrapper

This project intentionally does **not** include the `gradlew` / `gradlew.bat`
scripts or `gradle/wrapper/gradle-wrapper.jar`. Android Studio regenerates them
automatically on first sync (it reads `gradle/wrapper/gradle-wrapper.properties`,
which pins **Gradle 8.9**). If sync complains the wrapper is missing, run
**File → Sync Project with Gradle Files**, or from a terminal:

```
gradle wrapper --gradle-version 8.9
```

(using a system-installed Gradle once), after which `./gradlew` will exist.

---

## No configuration needed

You do **not** need to edit anything to run the app. The auth token and your data
come from the phone. Everything a non-coder might want to change lives in a single
file:

`app/src/main/java/com/app/judith/wear/Config.kt`

- `API_BASE` — the backend URL
- theme colours
- the Data Layer / SharedPreferences keys (must match the phone app)

---

## Running on a Wear OS emulator

1. **Tools → Device Manager → Create Device → Wear OS** (e.g. *Wear OS Large
   Round*, API 30+). Download a system image if prompted.
2. Select the `app` run configuration and the Wear emulator, then **Run**.
3. On first launch (with no data yet) you'll see the **Waiting** screen
   ("Open Judith on your phone to sync…"). That's expected — see below.

### Getting data onto the watch (testing)

Real data arrives from the paired phone over the Data Layer. To test without the
phone, you can push a DataItem to the emulator manually, or temporarily seed
`SharedPreferences` (file `judith.wear`, keys `watch_token`, `payload_v2`,
`updated_at`). In production the phone writes a DataItem at path
`/judith/watch-payload` containing:

| DataMap key            | Type   | Meaning                          |
|------------------------|--------|----------------------------------|
| `judith_payload_v2`    | String | the WatchPayload as JSON         |
| `judith_watch_token`   | String | the bearer auth token            |
| `updated_at`           | Long   | epoch millis of last update      |

The watch's `DataLayerListenerService` reads those and stores them. The UI then
becomes "ready" (token + cached payload present).

---

## Data Layer contract (phone ⇄ watch)

- **Path:** `/judith/watch-payload`
- The phone PUTs a DataItem at that path with the keys above.
- The watch listens via `DataLayerListenerService` (`onDataChanged`), persists to
  SharedPreferences, and the UI updates live.
- **Both the phone app and this watch app must share the same `applicationId`
  (`com.app.judith`) and be signed with the same signing key.** This is required
  by Google Play for Data Layer messaging and for the phone↔watch app to be
  linked/auto-installed. The Kotlin package is `com.app.judith.wear` (to avoid
  `R`-class clashes with the phone module) but the `applicationId` is
  `com.app.judith`.

---

## Backend endpoints

Base = `Config.API_BASE`. All calls send `Authorization: Bearer <watch_token>`.

| Method & path        | Body                                                                 | Response                                  |
|----------------------|----------------------------------------------------------------------|-------------------------------------------|
| `GET /watch-summary` | —                                                                    | `{ "payload": {…}, "updatedAt": "…" }`    |
| `POST /watch-ask`    | `{ text, localDate, localWeekday, history? }`                        | `{ "answer": "…", "actions"?: [...] }`    |
| `POST /watch-stt`    | `{ audioBase64, mimeType: "audio/m4a" }`                             | `{ "text": "…" }`                         |
| `POST /watch-action` | `{ action: "mark_paid"\|"snooze", billId, snoozeUntil? }`           | `{ "ok": true }`                          |

`/watch-summary` is a **pull fallback** (called on launch / resume). The Data
Layer push from the phone is the primary sync path. `/watch-action` is the
canonical mark-paid / snooze write.

---

## Permissions

- `INTERNET` — backend calls.
- `RECORD_AUDIO` — voice input for "Ask Judith" (requested at runtime).

---

## Project layout

```
android-native/wear/
├─ settings.gradle.kts
├─ build.gradle.kts
├─ gradle.properties
├─ gradle/wrapper/gradle-wrapper.properties
└─ app/
   ├─ build.gradle.kts
   ├─ proguard-rules.pro
   └─ src/main/
      ├─ AndroidManifest.xml
      ├─ res/…  (strings, theme, launcher icon, judith_avatar)
      └─ java/com/app/judith/wear/
         ├─ Config.kt              ← edit me
         ├─ MainActivity.kt        ← nav + pager
         ├─ data/                  ← models, prefs, backend, Data Layer, store
         └─ ui/                    ← theme, components, screens
```

---

## Things you may want to do later

- **Swap the avatar:** replace `res/drawable/judith_avatar.xml` (currently a mint
  circle with a "J") with a real asset.
- **Signing key:** add your release `signingConfig` in `app/build.gradle.kts`
  and use the **same key as the phone app** for Play linking + Data Layer.
- **Voice capture window:** `AskScreen` records a fixed ~6s window for simplicity;
  a production build would stop on a tap or on silence.
