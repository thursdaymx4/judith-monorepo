---
name: Judith managed prebuild / EAS build requirements
description: Why eas build & expo prebuild crashed, and the rules for keeping custom native autolinked so clean prebuilds work.
---

# Judith managed-prebuild (eas build / expo prebuild) rules

The deepest reason OTA never reached installed builds: the app could not be
regenerated via `expo prebuild` / `eas build` at all. Two root causes, both fixed:

## 1. Color-only splash crashes the expo-splash-screen prebuild plugin
A splash configured with **backgroundColor only and NO image** makes
`@expo/prebuild-config` take the `removeImageFromSplashScreen` path
(`InterfaceBuilder.js`), which throws `Cannot read properties of undefined (reading '0')`.
This breaks BOTH `expo config --type introspect` (what `eas build` runs to compute
entitlements) AND `expo prebuild`.

**Rule:** always give iOS splash an `image`. Configure it via the
`expo-splash-screen` config plugin (SDK 54 canonical), not the deprecated
top-level `expo.splash` key. An image routes through the add-image path and
avoids the crash. To keep a plain look, use a solid-color image instead of a logo.

## 2. Custom native must be autolinked, never force-added to ios/
**Rule:** keep ALL custom native in autolinked locations so a clean prebuild
regenerates everything; never `git add -f` files into the gitignored `ios/`.
A committed (even partial) `ios/` makes EAS treat the project as **bare** and
skip prebuild → build fails.
- Local Expo modules live in `modules/<name>/` (config + `ios/*Module.swift`).
  The Swift class MUST be `public class … : Module` / `public func definition()`
  (cross-pod ref from the generated provider); consume via
  `requireOptionalNativeModule("<Name>")` so it no-ops on Android / Expo Go.
- Widget + watch (incl. complications) come from `targets/` via `@bacons/apple-targets`.
- A stock Expo AppDelegate must NOT be committed (prebuild regenerates it);
  real AppDelegate customization needs a `withAppDelegate` config plugin.

**Why:** force-added native drifts from managed config and silently breaks
`eas build`; autolinked modules/targets survive clean cloud builds.

## OTA wiring once prebuild works
Channel comes from `eas.json` (production profile `channel: "production"`) — do
NOT also add `updates.requestHeaders.expo-channel-name` (that's only for non-EAS
builds). `app.json` has `updates.url` + `runtimeVersion.policy: appVersion` +
`expo-updates` plugin. So `eas build --profile production` → `eas submit`
produces a build that downloads OTAs; the force-apply hook applies on first reopen.
