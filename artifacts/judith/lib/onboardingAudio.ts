/**
 * Onboarding audio orchestration — single point of control for every TTS
 * request, persona-preview fetch, and Sound playback that fires during the
 * onboarding flow.
 *
 * Before this module existed, each onboarding screen called synthOnboarding
 * (or fetchSampleOnboarding) directly and forgot about it. If the user
 * advanced before the request returned, the response would still arrive and
 * play audio over the next screen — and there was no way to stop a "stuck"
 * request, leaving steps appearing frozen while a request hung.
 *
 * The fix is a module-level AbortController that owns every in-flight
 * request and every active Player. `cancelAll()` aborts the controller AND
 * tears down playback, so a single call from a navigation handler cleanly
 * stops everything. Each new request starts a fresh controller via
 * `beginSession()`, so by definition only one "session" of audio can be
 * in flight at a time.
 */
import { enqueueAudio, playBase64Mp3, playFromUrl, stopCurrentAudio } from "@/lib/audio";
import { fetchSampleOnboarding, synthOnboarding, AbortedError } from "@/lib/proxy";
import { getPersona, type PersonaId } from "@/constants/personas";

/**
 * The line Judith says on the onboarding Welcome screen. Exported so the
 * splash can prefetch it (see `prefetchSpeak`) and the Welcome screen can
 * use the exact same string — a one-character mismatch would defeat the
 * synth cache and re-introduce the "stuck for 5s" feel users reported.
 */
export const ONBOARDING_WELCOME_LINE =
  "Hi — I’m Judith. Your due date assistant. Let’s take control of your bills, shall we?";

/** The AbortController for the current onboarding audio "session." */
let _ctl: AbortController | null = null;

/**
 * Aborts the active session (if any) and starts a fresh one. Returns the
 * new signal so the caller can pass it to the proxy function it's about
 * to invoke. Pair with `cancelAll()` in the screen's cleanup to ensure
 * the session ends when the screen unmounts.
 */
export function beginSession(): AbortSignal {
  cancelAll();
  _ctl = new AbortController();
  return _ctl.signal;
}

/**
 * Returns the current session signal without disturbing it. Useful for a
 * second request that should ride the same cancellation lifecycle as the
 * first one (e.g. a follow-up parseBill after a transcribe). If no session
 * is active, opens one.
 */
export function currentSignal(): AbortSignal {
  if (!_ctl) _ctl = new AbortController();
  return _ctl.signal;
}

/**
 * Cancels every in-flight onboarding network request AND stops whatever
 * Sound is currently playing. Safe to call when nothing is active. Call
 * this from every screen-transition handler and on unmount.
 */
export function cancelAll(): void {
  if (_ctl) {
    try { _ctl.abort(); } catch { /* ignore */ }
    _ctl = null;
  }
  stopCurrentAudio();
}

/** True when an onboarding audio session is currently in flight. */
export function isSessionActive(): boolean {
  return _ctl !== null && !_ctl.signal.aborted;
}

/**
 * In-memory cache of audio bytes returned by `synthOnboarding`, keyed by
 * persona + language + text. Populated by `prefetchSpeak()` (called from
 * the splash to warm specific onboarding lines) and consumed by `speak()`
 * to skip the round-trip when a hit is found. The cache lives for the
 * lifetime of the JS module — small (one entry per prefetched line) so
 * memory growth isn't a concern.
 */
const _synthCache = new Map<string, string>();
function synthCacheKey(text: string, persona?: PersonaId, language?: string): string {
  return `${persona ?? "_"}|${language ?? "en"}|${text}`;
}

/**
 * Background prefetch — synthesize a line in advance and stash the bytes.
 * A subsequent `speak()` with the same text/persona/language plays without
 * any network wait. No playback, no session reset, failures are silent.
 *
 * Used by HandledSplash to warm the onboarding Welcome line during the
 * splash hold, so the "Let's begin" screen doesn't feel frozen on first
 * visit (the live synth round-trip is 2–5s for cold ElevenLabs caches).
 */
export function prefetchSpeak(
  text: string,
  persona?: PersonaId,
  language?: string,
): void {
  if (!text) return;
  const key = synthCacheKey(text, persona, language);
  if (_synthCache.has(key)) return;
  // Independent AbortController — prefetch must NOT ride the active session,
  // otherwise an unrelated cancelAll() (e.g. screen transition) would tear
  // down the prefetch mid-flight.
  const ctrl = new AbortController();
  synthOnboarding(text, persona, language, ctrl.signal)
    .then(({ audioBase64 }) => { _synthCache.set(key, audioBase64); })
    .catch(() => { /* best-effort */ });
}

/**
 * High-level "synthesize this line and play it" helper. The request, the
 * file write, and the playback all live under the same AbortSignal — calling
 * `cancelAll()` while this is in flight cleanly stops every stage.
 *
 * Resolves when playback finishes (or the session is cancelled). Never
 * throws — failures and cancellations both resolve to `void`, so callers
 * can fire-and-forget without try/catch noise.
 */
export async function speak(
  text: string,
  persona?: PersonaId,
  language?: string,
): Promise<void> {
  const signal = beginSession();
  try {
    // Cache hit — play immediately, no network wait. Crucial for the
    // Welcome screen where any latency reads as the whole tab being frozen.
    const key = synthCacheKey(text, persona, language);
    const cached = _synthCache.get(key);
    if (cached) {
      if (signal.aborted) return;
      await playBase64Mp3(cached);
      return;
    }
    const { audioBase64 } = await synthOnboarding(text, persona, language, signal);
    if (signal.aborted) return;
    // Stash for any future re-mount of the same screen.
    _synthCache.set(key, audioBase64);
    await playBase64Mp3(audioBase64);
  } catch (e) {
    if (e instanceof AbortedError) return;
    // Network failure or 5xx — silently drop the audio. The visible text
    // on screen is the source of truth; missing voice is acceptable.
  }
}

/**
 * Plays the pre-baked persona greeting sample (server-side cached audio).
 * Faster than `speak()` because the server pre-renders the line at build
 * time. Used by the persona-picker preview taps and any "intro" screens.
 *
 * Live-synth fallback: when the pregen endpoint returns non-200 (typically
 * because the server hasn't baked a sample for this persona/language combo
 * — e.g. `sib` + `britney` lacked English pregens, and any persona may
 * lack non-English pregens), we fall through to live ElevenLabs synth of
 * the persona's `line`. The live result is cached in `_synthCache` (via
 * `speak`'s cache) so subsequent taps play instantly.
 *
 * Live synth as a FALLBACK is fine — it's the unavoidable cost when no
 * pregen exists. We just don't make it the primary path (see project
 * memory `feedback_persona_voice_preview.md`).
 */
export async function preview(
  persona: PersonaId,
  language?: string,
): Promise<void> {
  const signal = beginSession();
  try {
    const { audioBase64 } = await fetchSampleOnboarding(persona, language, signal);
    if (signal.aborted) return;
    await playBase64Mp3(audioBase64);
    return;
  } catch (e) {
    if (e instanceof AbortedError) return;
    // Pregen unavailable — fall through to live synth below.
  }
  // ── Live synth fallback ────────────────────────────────────────────
  if (signal.aborted) return;
  const fallbackLine = getPersona(persona).line;
  try {
    // Check cache before hitting network — `speak()` populates this on every
    // successful synth, so a repeat tap on a previously-fallen-back persona
    // plays instantly.
    const cacheK = synthCacheKey(fallbackLine, persona, language);
    const cached = _synthCache.get(cacheK);
    if (cached) {
      if (signal.aborted) return;
      await playBase64Mp3(cached);
      return;
    }
    const { audioBase64 } = await synthOnboarding(fallbackLine, persona, language, signal);
    if (signal.aborted) return;
    _synthCache.set(cacheK, audioBase64);
    await playBase64Mp3(audioBase64);
  } catch (e) {
    if (e instanceof AbortedError) return;
    // Both pregen AND live synth failed — give up silently. The visible
    // persona row stays as "Playing…" briefly then clears.
  }
}

/**
 * Background prefetch — warm caches so a subsequent `preview()` call plays
 * instantly. Tries the pregen sample first; if that 404s, warms the live-
 * synth fallback so the first tap doesn't pay the 2–5s ElevenLabs cost.
 *
 * Deliberately doesn't use beginSession — prefetch must NOT cancel an
 * actively playing preview. It just primes both caches in the background.
 * Failures silently swallowed.
 */
export function prefetchPreview(
  persona: PersonaId,
  language?: string,
): void {
  fetchSampleOnboarding(persona, language)
    .catch(() => {
      // Pregen unavailable — warm the live-synth fallback so the first
      // user tap doesn't stall waiting for ElevenLabs to round-trip.
      const fallbackLine = getPersona(persona).line;
      prefetchSpeak(fallbackLine, persona, language);
    });
}

/**
 * Direct enqueue for the rare callers that already have audio bytes in
 * hand (e.g. from a custom synth flow). Enqueues into the shared player
 * queue so it respects subsequent cancellations.
 */
export function enqueue(audioBase64: string): void {
  enqueueAudio(audioBase64);
}

/**
 * Direct URL playback for screens that hand us a remote URL instead of
 * base64. Routed through the same `cancelAll()` cleanup as everything else.
 */
export async function playUrl(url: string): Promise<void> {
  beginSession();
  try {
    await playFromUrl(url);
  } catch {
    /* swallow */
  }
}
