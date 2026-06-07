---
name: Judith Xcode 26 Font API changes
description: Which Font.system overloads were removed in iPhoneOS26.0.sdk and the working replacements for Watch vs widget targets.
---

## What broke in Xcode 26 (iPhoneOS26.0.sdk)

All of these `Font.system` overloads that take a `Font.TextStyle` as first arg were removed:
- `Font.system(_ style: Font.TextStyle)` — gone
- `Font.system(_ style: Font.TextStyle, design: Font.Design?)` — gone (iOS widget target only; still works in watchOS SDK)
- `Font.system(_ style: Font.TextStyle, weight: Font.Weight, design: Font.Design)` — gone from both
- `Font.design(_ design: Font.Design) -> Font` instance method — gone from iOS 26

**Why:** Apple reorganized the Font API in iOS/watchOS 26. The only `Font.system` overload remaining requires explicit `size: CGFloat`.

## Working replacements

### watchOS target (watchOS SDK — less strict)
`Font.system(Font.TextStyle.xxx, design: .rounded)` with explicit type still works.
Chained `.weight()` on Font still works.

```swift
// Watch files — OK
.font(.system(Font.TextStyle.headline, design: .rounded).weight(.bold))
```

### iOS widget target (iPhoneOS26.0.sdk — strictest)
Must use view-level modifiers `.fontDesign()` and `.fontWeight()` (iOS 16+):

```swift
// Widget files — correct approach
Text(...)
    .font(.caption)           // predefined Font constant, no Font.system needed
    .fontWeight(.semibold)    // View modifier, not Font method
    .fontDesign(.rounded)     // View modifier, not Font method
```

`Font.system(size: CGFloat, weight:, design:)` with explicit CGFloat size still works in both targets.

## How to apply
- Any Swift file in `targets/widget/` that styled fonts via `Font.system(.textStyle, ...)`: use view modifiers.
- Any Swift file in `targets/watchos/` that styled fonts: `Font.system(Font.TextStyle.xxx, design:)` is OK, but avoid the 3-arg form with `weight:`.
- The `Config.swift` font constants use `Font.system(Font.TextStyle.body, design: .monospaced).weight(.semibold)` — this compiles fine for watchOS.
