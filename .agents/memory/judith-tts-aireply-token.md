---
name: Judith /tts aiReply fast-path token
description: Why Ask-Judith voice is decoupled from text, and the HMAC token that protects the moderation skip.
---

# /tts aiReply fast path + HMAC token

Ask Judith voice was slow because `/ask` synthesized TTS inline (doTts) so the whole
reply waited on ElevenLabs before any text showed. Fix: client calls `/ask` with
includeVoice=false (fast text path; this awaited call still drives ALL metering/refund/
error logic), then fires `synthesizeAiReply()` separately so audio trails the text.

`/tts` has an `aiReply:true` fast path that skips `isSafeForTTS` moderation (a full
Sonnet round-trip that can exceed TTS latency) and uses the flash model (live:true).

**Why the token:** `aiReply` is client-supplied, so without a guard any authenticated
client could set it to synthesize arbitrary UNMODERATED speech — a moderation bypass.
`/ask` issues a short-lived HMAC token (`${exp}.${hmac(exp|reply)}`) over the exact
reply text; `/tts` only takes the fast path when `verifyAiReplyToken(token,text)` passes.
Invalid/missing token → falls back to the normal moderated path (safe default, just slow).

**How to apply:** the HMAC key falls back across TTS_SIGNING_SECRET →
SUPABASE_SERVICE_ROLE_KEY → ELEVENLABS_API_KEY (must be stable across autoscale
instances — never a per-process random key, or /ask and /tts land on different boxes).
Token TTL is 5min. Voice consistency: both /ask and /tts resolve voice via
`getVoiceId(persona,language,countryCode)`, so pass persona+language+country.code on the
decoupled call. Client only fires audio when reply is non-empty AND a token is present.
