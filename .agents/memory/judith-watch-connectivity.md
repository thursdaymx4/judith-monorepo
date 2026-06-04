---
name: Judith WatchConnectivity crash
description: react-native-watch-connectivity crashes in Expo Go; fix is try/catch around require(), NOT await import().
---

## Rule
Use `try { WatchConnectivity = require("react-native-watch-connectivity") } catch {}` at module level. A `null` check in every call site makes all sync paths safe no-ops in Expo Go.

**Why:** `TurboModuleRegistry.getEnforcing("RNWatch")` is called synchronously during module evaluation. In Expo Go the native module is absent so it throws immediately. A synchronous `try/catch` around `require()` DOES catch this. However, `try { await import(...) } catch {}` does NOT — the throw happens before the Promise resolves. The previous note had this backwards.

The top-level `require()` crash propagated before `JudithProvider` could mount, causing a cascading "useJudith must be used within JudithProvider" render error on the onboarding screen.

**How to apply:**
- `lib/watch.ts`: `let WatchConnectivity = null; try { WatchConnectivity = require(...) } catch {}`
- Guard every call site: `if (!WatchConnectivity) return;`
- The Metro config + watch-stub.js approach documented in comments was never implemented and is not needed; the try/catch is simpler and sufficient.
- Watch sync still only fires on a real device with a compiled Watch target — the guard just prevents the crash in Expo Go.
