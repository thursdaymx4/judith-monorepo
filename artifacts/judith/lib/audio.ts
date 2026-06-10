import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

let counter = 0;
/** The one player that is currently (or most recently) playing. */
let _activePlayer: ReturnType<typeof createAudioPlayer> | null = null;
let _activeUri: string | null = null;

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
 * Stop and dispose whatever Judith audio is currently playing.
 * Safe to call even when nothing is active.
 */
export function stopCurrentAudio() {
  const p = _activePlayer;
  const uri = _activeUri;
  _activePlayer = null;
  _activeUri = null;
  if (p) {
    try { p.pause(); } catch { /* ignore */ }
    try { p.remove(); } catch { /* ignore */ }
  }
  void cleanupUri(uri);
}

/**
 * Plays audio directly from a remote URL (e.g. a public GCS URL).
 * Faster than base64 — no file write step, player streams directly.
 * Resolves when playback finishes (or the player is replaced).
 */
export async function playFromUrl(url: string, rate = 1.0): Promise<void> {
  stopCurrentAudio();
  await setAudioModeAsync({ playsInSilentMode: true });
  const player = createAudioPlayer(url);
  _activePlayer = player;
  _activeUri = null;
  try { (player as unknown as { rate: number }).rate = rate; } catch { /* unsupported */ }
  player.play();
  return new Promise<void>((resolve) => {
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        sub.remove();
        if (_activePlayer === player) _activePlayer = null;
        try { player.remove(); } catch { /* ignore */ }
        resolve();
      }
    });
  });
}

/**
 * Writes base64 mp3 to cache, stops any currently playing audio,
 * then plays the new clip at the requested rate.
 * Resolves when playback finishes (or the player is replaced).
 */
export async function playBase64Mp3(base64: string, rate = 1.0): Promise<void> {
  // Immediately stop whatever was playing so voices never overlap.
  stopCurrentAudio();

  const uri = `${FileSystem.cacheDirectory}judith-${Date.now()}-${counter++}.mp3`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await setAudioModeAsync({ playsInSilentMode: true });

  const player = createAudioPlayer(uri);
  _activePlayer = player;
  _activeUri = uri;

  // Faster playback — 1.2× feels snappier without sounding rushed.
  // expo-audio's TS types don't expose `rate` yet, so we cast.
  try { (player as unknown as { rate: number }).rate = rate; } catch { /* unsupported on this device/version */ }

  player.play();

  return new Promise<void>((resolve) => {
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
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
  });
}

/** Reads a recorded file URI and returns its base64 contents. */
export async function fileToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
