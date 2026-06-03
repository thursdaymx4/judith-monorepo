---
name: Judith tier model
description: AskTier values, plan names, prices, and where they must stay in sync
---

`AskTier = "free" | "chat" | "voice"` — defined in `JudithStore.tsx`.

| Tier    | RC entitlement   | Price    | Capabilities                          |
|---------|-----------------|----------|---------------------------------------|
| `free`  | none            | —        | 8 free asks (counted), no voice       |
| `chat`  | `chat_ask`      | ₱99/mo   | Unlimited text asks, NO voice input   |
| `voice` | `voice_ask`     | ₱199/mo  | Unlimited text + voice asks           |

**Why:** Previous model had "Judith+" / "Judith Unlimited" which didn't map cleanly to the chat-vs-voice distinction. The rename makes the feature boundary obvious.

**How to apply:**
- Onboarding paywall (`ScreenAskPaywall`): show "Chat Ask" and "Voice Ask" cards, default pick = "chat".
- Voice gate in `ask.tsx → startRecording()`: if `tier === "chat"` → show `voiceUpgradeVisible` bottom-sheet modal (not just route to /plans).
- `canUseVoice()` in JudithStore: returns `true` only when `tier === "voice"`. The `startRecording` gate checks `tier === "chat"` directly (avoid importing `canUseVoice` unless needed).
- RC sync: `getActiveTier()` called in `_layout.tsx` `useEffect` keyed on `session?.user?.id`; result synced via `subscribe(tier)`.
- `paid = tier === "chat" || tier === "voice"` — both plans suppress the free-ask counter.
