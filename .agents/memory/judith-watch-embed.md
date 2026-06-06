---
name: Judith Watch embed approach
description: How the Apple Watch app is embedded inside the phone EAS build via @bacons/apple-targets.
---

## Rule
Use `@bacons/apple-targets` (type `watch`) to embed the Watch app as a native target inside the Judith EAS build. The Watch app must share the phone app's bundle ID prefix (`com.app.judith.watchkitapp`) for WatchConnectivity to pair them.

**Why:** WatchConnectivity strictly pairs by bundle ID. A standalone Xcode project with a different root bundle ID (e.g. `com.judith.JudithWatch.watchkitapp`) cannot communicate with `com.app.judith` — `getIsWatchAppInstalled()` returns false and `transferUserInfo` goes to a different WCSession pair. The fix is to embed the Watch as a target inside the phone build.

**How to apply:**
- Swift source files live in `artifacts/judith/targets/watchos/`
- `expo-target.config.js` sets `type: "watch"`, `bundleIdentifier: ".watchkitapp"` (relative — appended to `com.app.judith`), and `entitlements: { "com.apple.security.application-groups": ["group.com.app.judith"] }`
- `app.json` must have `"com.apple.security.application-groups": ["group.com.app.judith"]` in `ios.entitlements` and `"@bacons/apple-targets"` in plugins
- The plugin auto-sets the watchOS deployment target to 11.0 for `type: "watch"`; no explicit `deploymentTarget` needed unless you want a different minimum
- `watch.ts` `syncBillsToWatch`: do NOT gate on `getIsWatchAppInstalled()` — remove that check; `transferUserInfo` handles unconnected Watch gracefully
- EAS build command: `EXPO_NO_CAPABILITY_SYNC=1 eas build --platform ios --profile production --auto-submit` from `artifacts/judith`
- The embedded Watch app installs automatically on the paired Watch via the Watch app on the phone after installing the TestFlight phone build

## Key files
- `artifacts/judith/targets/watchos/expo-target.config.js`
- `artifacts/judith/targets/watchos/*.swift` (15 files)
- `artifacts/judith/app.json` (plugin + entitlements)
- `artifacts/judith/lib/watch.ts` (removed getIsWatchAppInstalled gate)
