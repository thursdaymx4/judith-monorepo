---
name: Judith WatchConnectivity crash
description: react-native-watch-connectivity crashes in Expo Go because its native module init is uncatchable; requires a dev build.
---

## Rule
Never dynamically import `react-native-watch-connectivity` in code that runs in Expo Go. The package's `NativeWatchConnectivity.js` calls `TurboModuleRegistry.getEnforcing("WatchConnectivity")` at the **top level of the module** (synchronously during evaluation), before any JS catch block can run. Wrapping `await import("react-native-watch-connectivity")` in try/catch does NOT prevent the crash.

**Why:** `TurboModuleRegistry.getEnforcing()` throws synchronously during Metro's module registry initialization. By the time the dynamic `import()` Promise would reject, the throw has already propagated out of the JS engine's module evaluator.

**How to apply:**
- Apple Watch sync (feature #5) must be implemented in a **development build** (not Expo Go) that includes the WatchConnectivity native binary.
- Until then, `sendSessionToWatch` in AuthContext.tsx is a no-op placeholder.
- Do not add any `import` (static or dynamic) of `react-native-watch-connectivity` to any file that loads in Expo Go.
- When implementing feature #5, use a conditional check on a custom native module availability guard (not `NativeModules.WatchConnectivity` — that's unreliable as a stub may exist).
