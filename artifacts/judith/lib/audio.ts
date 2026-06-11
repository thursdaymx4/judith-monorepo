import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

let counter = 0;
/** The one player that is currently (or most recently) playing. */
let _activePlayer: ReturnType<typeof createAudioPlayer> | null = null;
let _activeUri: string | null = null;
/** Subscription for the active player — must be removed before disposing the player. */
let _activeSub: { remove: () => void } | null = null;
/** Resolve fn of the in-flight playback promise. Calling it unblocks the queue
 *  pump when audio is force-stopped externally — otherwise the await hangs
 *  forever, the pump never exits, and closures leak per-clip. */
let _activeResolve: (() => void) | null = null;
interface QueuedClip {
  uri: string;
  ready: Promise<void>;
}
/** FIFO of MP3 clips waiting to be played sequentially.
 *  Each entry has already started writing to disk so the pump
 *  can await the ready-promise and start playback immediately. */
let _audioQueue: QueuedClip[] = [];
let _audioPumpRunning = false;

/**
 * Switch the iOS audio session back to playback-only. Call after `recorder.stop()`
 * — the PlayAndRecord category persists across recorder lifecycle and a leftover
 * record session degrades subsequent playback latency.
 */
export const resetAudioToPlayback = () =>
  setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

async function cleanupUri(uri: string | null) {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}

/**
 * Stop and dispose whatever Judith audio is currently playing, and clear any
 * queued chunks waiting behind it. Pass `{ keepQueue: true }` from the queue
 * pump itself so playing the next chunk doesn't erase its own siblings.
 * Safe to call even when nothing is active.
 */
export function stopCurrentAudio(opts?: { keepQueue?: boolean }) {
  if (!opts?.keepQueue) { _audioQueue = []; }
  const p = _activePlayer;
  const uri = _activeUri;
  const sub = _activeSub;
  const resolveFn = _activeResolve;
  _activePlayer = null;
  _activeUri = null;
  _activeSub = null;
  _activeResolve = null;
  // Remove the subscription BEFORE removing the player so no stale
  // playbackStatusUpdate callbacks accumulate across multiple audio plays.
  if (sub) { try { sub.remove(); } catch { /* ignore */ } }
  if (p) {
    try { p.pause(); } catch { /* ignore */ }
    try { p.remove(); } catch { /* ignore */ }
  }
  // Resolve the in-flight playback promise so its caller (e.g. the queue pump
  // or an awaited playFromUrl) can advance and release its closure.
  if (resolveFn) { try { resolveFn(); } catch { /* ignore */ } }
  void cleanupUri(uri);
}

/**
 * Plays audio directly from a remote URL (e.g. a public GCS URL).
 * Faster than base64 — no file write step, player streams directly.
 * Resolves when playback finishes (or the player is replaced).
 */
export async function playFromUrl(url: string, rate = 1.0): Promise<void> {
  stopCurrentAudio();
  await resetAudioToPlayback();
  const player = createAudioPlayer(url);
  _activePlayer = player;
  _activeUri = null;
  try { (player as unknown as { rate: number }).rate = rate; } catch { /* unsupported */ }
  player.play();
  return new Promise<void>((resolve) => {
    _activeResolve = resolve;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        if (_activeSub === sub) _activeSub = null;
        if (_activeResolve === resolve) _activeResolve = null;
        sub.remove();
        if (_activePlayer === player) _activePlayer = null;
        try { player.remove(); } catch { /* ignore */ }
        resolve();
      }
    });
    _activeSub = sub;
  });
}

/**
 * Writes base64 mp3 to cache, stops any currently playing audio,
 * then plays the new clip at the requested rate.
 * Resolves when playback finishes (or the player is replaced).
 */
export async function playBase64Mp3(base64: string, rate = 1.0): Promise<void> {
  // Stop the active player so clips never overlap — but keep any queued
  // chunks so the next `enqueueAudio` chunk still gets a turn.
  stopCurrentAudio({ keepQueue: true });

  const uri = `${FileSystem.cacheDirectory}judith-${Date.now()}-${counter++}.mp3`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await resetAudioToPlayback();

  const player = createAudioPlayer(uri);
  _activePlayer = player;
  _activeUri = uri;

  // Faster playback — 1.2× feels snappier without sounding rushed.
  // expo-audio's TS types don't expose `rate` yet, so we cast.
  try { (player as unknown as { rate: number }).rate = rate; } catch { /* unsupported on this device/version */ }

  player.play();

  return new Promise<void>((resolve) => {
    _activeResolve = resolve;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        if (_activeSub === sub) _activeSub = null;
        if (_activeResolve === resolve) _activeResolve = null;
        sub.remove();
        const finishedUri = _activePlayer === player ? _activeUri : uri;
        if (_activePlayer === player) {
          _activePlayer = null;
          _activeUri = null;
        }
        try { player.remove(); } catch { /* ignore */ }
        void cleanupUri(finishedUri);
        resolve();
      }
    });
    _activeSub = sub;
  });
}

/**
 * Append a base64 MP3 to the playback queue and start draining if idle.
 * The disk write begins immediately so it can complete in parallel with
 * React rendering the text reply, minimising the text→audio gap.
 */
export function enqueueAudio(base64: string) {
  const uri = `${FileSystem.cacheDirectory}judith-${Date.now()}-${counter++}.mp3`;
  const ready = FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  _audioQueue.push({ uri, ready });
  if (!_audioPumpRunning) void pumpAudioQueue();
}

async function pumpAudioQueue() {
  _audioPumpRunning = true;
  try {
    while (_audioQueue.length > 0) {
      const next = _audioQueue.shift();
      if (!next) continue;
      try { await playFromWrittenUri(next); } catch { /* skip and continue */ }
    }
  } finally {
    _audioPumpRunning = false;
  }
}

/** Play an already-queued clip whose disk write may still be in flight. */
async function playFromWrittenUri({ uri, ready }: QueuedClip): Promise<void> {
  stopCurrentAudio({ keepQueue: true });
  await ready;
  await resetAudioToPlayback();
  const player = createAudioPlayer(uri);
  _activePlayer = player;
  _activeUri = uri;
  try { (player as unknown as { rate: number }).rate = 1.0; } catch { /* unsupported */ }
  player.play();
  return new Promise<void>((resolve) => {
    _activeResolve = resolve;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        if (_activeSub === sub) _activeSub = null;
        if (_activeResolve === resolve) _activeResolve = null;
        sub.remove();
        const finishedUri = _activePlayer === player ? _activeUri : uri;
        if (_activePlayer === player) { _activePlayer = null; _activeUri = null; }
        try { player.remove(); } catch { /* ignore */ }
        void cleanupUri(finishedUri);
        resolve();
      }
    });
    _activeSub = sub;
  });
}

/** Reads a recorded file URI and returns its base64 contents. */
export async function fileToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
