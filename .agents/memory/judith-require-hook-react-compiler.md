---
name: Judith — no require()-imported hooks under React Compiler
description: Why obtaining a hook via runtime require() crashes with "Invalid hook call" in this Expo app, and the rule to follow instead.
---

# Never get a hook from a runtime `require()` (React Compiler is enabled)

This Expo app runs with the **React Compiler enabled** (see "React Compiler enabled"
in the Metro startup log). A component that obtains a hook through a runtime
`require(...)` and then calls it — e.g. `const { useJudith } = require("@/contexts/JudithStore"); useJudith();`
— intermittently crashes with **"Invalid hook call ... in <RootLayoutNav>"** (the
generic message that also mentions "more than one copy of React", which is a red
herring here — there is only one `react@19.x` in the pnpm graph).

**Why:** the compiler can't statically recognize a hook accessed via `require`, so its
memoization/transform can desync the hook dispatcher. The crash is intermittent and
often hides behind the splash overlay (zIndex 100, ~4.6s), so it looks like "the app
crashed on open."

**How to apply:** always import hooks with a normal top-level `import`. The lazy
`require` was added "to avoid a cycle" — but verify before assuming a cycle exists.
In this app `contexts/JudithStore.tsx` (and its `constants/*` deps) do NOT import
`components/ui.tsx`, so there was no real cycle and the static import is safe.

**Debugging tip:** to see a screen hidden behind the splash, temporarily set
`splashDone` initial state to `true` in `app/_layout.tsx` (and flip the
`Stack.Protected` guards) to force-render login / tabs / onboarding / ask, then revert.
