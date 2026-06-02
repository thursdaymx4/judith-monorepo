---
name: Judith safe-area top inset on web/canvas
description: Why top headers become untappable in the canvas preview and how to fix it
---

On Expo **web** (the canvas iframe preview), `useSafeAreaInsets()` returns `top: 0`
because there is no real notch/status bar. But the canvas renders a device-frame
chrome (fake iOS status bar with time/wifi/battery) *on top of* the iframe. So any
full-screen surface that uses `paddingTop: insets.top + N` renders its header under
that chrome — the header (e.g. the home bell button) is visually clipped and
**untappable**.

**Rule:** floor the top inset on every full-screen surface that has a top header:
`paddingTop: Math.max(insets.top, 44) + N`. This mirrors the tab bar, which already
floors the bottom with `Math.max(insets.bottom, 8)`.

**Why:** on native, `insets.top` is already ≥44 so `Math.max` is a no-op; the floor
only kicks in on web/canvas where insets are 0. Without it the top regresses every
time someone reintroduces a bare `insets.top`.

**How to apply:** the shared `Screen` component (components/ui.tsx) already floors it,
so prefer `Screen`. Screens that build their own root View with a header (e.g.
app/ask.tsx) must apply the same floor themselves.
