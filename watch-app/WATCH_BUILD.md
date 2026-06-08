# Judith Apple Watch app — build & integration plan

This folder holds the **native SwiftUI** watch app, written from `WATCH_APP.md`. It is **not
wired into the build yet** (on purpose — so it can't break your iPhone dev build). It compiles
and runs only through **Xcode**, and ships **inside** the iOS app.

## What's here (`watch-app/`)
- `JudithWatch/` — the watch app
  - `WatchModels.swift` — `Bill`, urgency, money, `BillStore` (sample data + sync hooks)
  - `WatchTheme.swift` — black OLED + mint accent + urgency colors + tabular numbers
  - `JudithWatchApp.swift` — `@main` + **Up next** list (header total + bill rows → detail)
  - `BillDetailView.swift` — provider, big amount, due, **Mark paid** / **Snooze 1 day**
  - `MarkedPaidView.swift` — mint check confirmation + 🔥 streak nudge + success haptic
  - `WatchSync.swift` — WatchConnectivity bridge (sends mark-paid/snooze to the phone)
- `JudithWidgets/JudithWidgets.swift` — watch-face **complication** + **Smart Stack** widget (NEXT DUE)

Still to add later (from `WATCH_APP.md`): the long-look **reminder notification** with inline
Pay/Remind actions, and the optional spoken verdict.

## Prerequisites (the honest list)
1. **Xcode** (full, from the Mac App Store — several GB). You currently have only Command Line Tools. Required to compile/preview any Swift.
2. The **iPhone dev build working first** (`DEV_BUILD.md`) — the watch app is embedded in the iOS app, so the EAS pipeline + Apple Developer account must exist.
3. Apple Watch **simulator** (ships with Xcode) or a real paired Apple Watch.

## Two ways to attach it to the Expo app
**Option A — `@bacons/apple-targets` (stays in Expo, builds via EAS):**
1. `npx expo install @bacons/apple-targets` and add `"@bacons/apple-targets"` to `app.json` → `plugins`.
2. Move `JudithWatch/` + `JudithWidgets/` into `targets/` with an `expo-target.config.js` declaring a `watch` target (+ a `widget` target), the App Group, and the bundle ids (`com.thursdaymx4.judith.watchkitapp`, …).
3. `npx expo prebuild -p ios` then `eas build -p ios --profile development`. The watch app installs alongside the phone app.

**Option B — Xcode targets (bare):** after `npx expo prebuild`, open `ios/*.xcworkspace` in Xcode → File ▸ New ▸ Target ▸ **watchOS App** + **Widget Extension**; drop these files in; set the shared **App Group** on phone, watch, and widget. Build/run from Xcode.

> Recommendation: do **Option A** so everything stays in the one Expo project and builds in the cloud. I'll wire the `targets/` config + `expo-target.config.js` when you've installed Xcode and the iPhone dev build is green.

## Data sync (phone ↔ watch)
- Phone writes `{bills, streak, currencySymbol}` to a shared **App Group** container (and/or `WCSession.updateApplicationContext`). The watch's `BillStore` reads it (replace the sample seed).
- Watch → phone: `WatchSync` sends `{action: markPaid|snooze, billId}`. Implement the matching `WCSessionDelegate` on the phone (a tiny native module / config-plugin) to apply it and write back to Supabase. Complications read the same App Group values.
- `Money.symbol` is set from the phone's selected country.

## Design fidelity check (vs WATCH_APP.md)
- ☑ Black bg, mint accent `#29d5a5`, urgency colors match phone, monospaced numbers
- ☑ Up-next list (urgency dot · provider · in Nd/Nd-late · amount), tap → detail
- ☑ Detail Mark paid (primary) / Snooze 1 day
- ☑ Marked-paid confirmation + streak + success haptic
- ☑ Complication + Smart Stack rectangular ("NEXT DUE · provider · amount · count · total")
- ☐ Long-look reminder notification (Pay/Remind) — add with the notifications work
- ☐ Live data via App Group/WatchConnectivity (currently sample seed)
