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
- `canUseVoice()` in JudithStore: `true` for `tier === "voice"` AND for `free` while `asksLeft > 0` (only `chat` is always false). So free trial users DO get spoken replies until asks run out. The `startRecording` gate checks `tier === "chat"` directly.
- Voice-mute (`toggles.voiceReplies`) must be gated to the voice tier in the effective-TTS calc (`!voiceTier || speakAloud`); otherwise a user who mutes then downgrades to free would silently lose spoken replies with no visible control to re-enable.
- RC sync: `getActiveTier()` called in `_layout.tsx` `useEffect` keyed on `session?.user?.id`; result synced via `subscribe(tier)`.
- `paid = tier === "chat" || tier === "voice"` — both plans suppress the free-ask counter.

**Voice mute (text-only in public):** voice-tier users can silence spoken replies via `toggles.voiceReplies` (default true). Effective TTS = `canUseVoice() && (!voiceTier || toggles.voiceReplies)` — passed as the `wantVoice` arg to `askJudith`, so muting also skips server-side TTS generation. Toggle UI: speaker button in `ask.tsx` header (voice tier only) + a "Speak answers aloud" row in Settings "Voice" section.

**Toggles hydration gotcha:** `Toggles` is persisted as a nested object and hydration shallow-spreads `{...DEFAULTS, ...parsed}`, which replaces the whole `toggles` object. Any NEW toggle key must be deep-merged (`toggles: {...DEFAULTS.toggles, ...parsed.toggles}`) or existing users load it as `undefined`.
