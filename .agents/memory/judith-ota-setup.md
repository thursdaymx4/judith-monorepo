---
name: Judith OTA setup
description: What's required for eas update (OTA) to work in this pnpm monorepo
---

## Rule
`eas update` requires two things in this project that a plain EAS build does not:

1. **`babel-preset-expo` as a direct devDependency** (`"babel-preset-expo": "54.0.11"` in `artifacts/judith/package.json`)
   - pnpm doesn't hoist transitive deps; Metro can't resolve `babel-preset-expo` at bundle time unless it's a direct dep.
   - Pin to `54.0.11` — the version expo@54 already uses internally (already in pnpm store, no new download).

2. **`transformIgnorePatterns` in `metro.config.js`**
   - Metro skips Babel for `node_modules` by default.
   - Packages like `react-native-reanimated@4.x` ship compiled JS with private class fields (`#x`, `#y`, `#width`, `#height`).
   - The `hermesc` binary bundled in the `react-native` npm package rejects these; EAS cloud builds use a newer hermesc that's fine.
   - Pattern to use:
     ```
     node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|react-native-svg|react-native-reanimated|react-native-gesture-handler|@bacons/.*)/))
     ```

**Why:** local `hermesc` (npm package) is older than EAS cloud hermesc; private class fields pass through Metro untransformed and hermesc rejects them with "private properties are not supported".

**How to apply:** any time OTA is set up on a new clone / machine, ensure both are present. If `eas update` fails with "Cannot find module 'babel-preset-expo'", check #1. If it fails with "private properties are not supported", check #2.

## Mac workflow after pulling these changes
```bash
pnpm install   # no --frozen-lockfile (package.json changed)
cd artifacts/judith
eas update --channel production --message "your message"
```
