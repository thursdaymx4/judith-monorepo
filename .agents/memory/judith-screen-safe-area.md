---
name: Judith Screen safe-area top inset
description: Why tab screens must not override Screen's paddingTop, and why modal screens can.
---

# Screen top inset vs contentStyle paddingTop

`components/ui.tsx` `Screen` applies a Dynamic-Island-safe top pad
(`Math.max(insets.top, 44) + 12`) via `contentContainerStyle`. Because
`contentStyle` is merged AFTER, any screen passing `contentStyle={{ paddingTop: N }}`
with a small N clobbers that inset and slides its header under the status
bar / Dynamic Island.

**Rule:** root **tab** screens (`app/(tabs)/*` — home, calendar, insights,
settings) must NOT set `paddingTop` in `contentStyle`; let `Screen`'s default
own the top inset. They may still set other props (e.g. `paddingBottom`).

**Why modal screens differ:** pushed routes (`bills`, `devices`, `plans`,
`reminders`, `bill/[id]`, `add-bill`, `ask`) are `presentation: "modal"` in
`app/_layout.tsx`. iOS modal cards already start below the island, so their
small `paddingTop` (and `SheetHeader`) is intentional — do not strip it.
