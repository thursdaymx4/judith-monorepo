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
import type { PersonaId } from "@/constants/personas";

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
    const { audioBase64 } = await synthOnboarding(text, persona, language, signal);
    if (signal.aborted) return;
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
  } catch (e) {
    if (e instanceof AbortedError) return;
  }
}

/**
 * Background prefetch — warm the server-side persona-sample cache so a
 * subsequent `preview()` call plays instantly. No playback, no session
 * reset, errors silently swallowed. Safe to fire on a list-render effect.
 */
export function prefetchPreview(
  persona: PersonaId,
  language?: string,
): void {
  // Deliberately doesn't use beginSession — prefetch should NOT cancel
  // an actively playing preview. It just primes the cache in the background.
  void fetchSampleOnboarding(persona, language).catch(() => {});
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
