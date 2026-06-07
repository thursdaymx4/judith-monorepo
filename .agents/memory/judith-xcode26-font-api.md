---
name: Judith Xcode 26 font API changes
description: Which Font APIs were removed in iPhoneOS26.0.sdk and the only universally-working replacement for the widget target.
---

## What is removed in Xcode 26 (iPhoneOS26.0.sdk — widget target)

- `Font.system(_ style: Font.TextStyle)` — gone
- `Font.system(_ style: Font.TextStyle, design: Font.Design?)` — gone
- `Font.system(_ style: Font.TextStyle, weight: Font.Weight, design: Font.Design)` — gone
- `Font.design(_ design: Font.Design) -> Font` instance method — gone
- `.fontDesign()` view modifier — requires iOS 16.1, widget deployment target is below that → availability error

## What STILL WORKS everywhere (iOS 13+, Xcode 26)

```swift
Font.system(size: CGFloat, weight: Font.Weight, design: Font.Design)
```

This is the ONLY safe approach for the widget target. Use hardcoded Apple DT point sizes:

| TextStyle  | Size |
|------------|------|
| caption2   | 11   |
| caption    | 12   |
| footnote   | 13   |
| callout    | 16   |
| body       | 17   |
| title3     | 20   |
| title2     | 22   |
| title      | 28   |
| largeTitle | 34   |

Example:
```swift
// Instead of .font(.caption.weight(.semibold).design(.rounded))
// or .font(.caption).fontWeight(.semibold).fontDesign(.rounded)
.font(.system(size: 12, weight: .semibold, design: .rounded))
```

## watchOS target (different SDK — more permissive)

`Font.system(Font.TextStyle.xxx, design: .rounded)` with explicit type still works.
Chained `.weight()` on Font still works.
Do NOT use the 3-arg form `Font.system(style:weight:design:)`.

## How to apply
- **Widget target** (`targets/widget/`): Use ONLY `Font.system(size: N, weight:, design:)`. No Font instance methods, no `.fontDesign()`, no `.fontWeight()` view modifiers.
- **Watch target** (`targets/watchos/`): `Font.system(Font.TextStyle.xxx, design:).weight(.xxx)` is fine.

**Why:** Apple reorganized/removed the style-based Font.system overloads in iOS 26 SDK. The size-based overload is the stable API that has existed since iOS 13 and survives.
