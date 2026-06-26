/**
 * Microphone permission + warmup helper.
 *
 * The problem: on iOS, the very first `recorder.record()` call right
 * after a user grants the microphone permission produces silent audio.
 * The native AVAudioSession hasn't fully activated yet — the OS prompt
 * resolves before the audio engine commits the new session state. From
 * the user's POV the mic icon turns on but nothing they say registers.
 *
 * The fix: detect a fresh grant by reading the permission status BEFORE
 * the request. If the pre-request status wasn't "granted" and the
 * post-request status is, give the session a short warmup window
 * (400ms) before letting the caller start recording. Subsequent taps
 * skip the delay entirely.
 *
 * Usage:
 *   const ok = await ensureMicReady();
 *   if (!ok) { setErr("Mic permission needed"); return; }
 *   await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
 *   await recorder.prepareToRecordAsync();
 *   recorder.record();
 */
import { AudioModule } from "expo-audio";

const WARMUP_MS = 400;

export type MicPermissionResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable"; canAskAgain: boolean };

type RecordingPermission = {
  granted?: boolean;
  status?: string;
  canAskAgain?: boolean;
};

export async function ensureMicPermission(): Promise<MicPermissionResult> {
  // Pre-check so we can tell whether this turn is a fresh grant. If the
  // platform doesn't expose getRecordingPermissionsAsync, treat the
  // status as undetermined — the warmup is cheap on a repeated grant.
  let wasGrantedBefore = false;
  try {
    const getFn = (AudioModule as unknown as {
      getRecordingPermissionsAsync?: () => Promise<RecordingPermission>;
    }).getRecordingPermissionsAsync;
    if (getFn) {
      const current = await getFn.call(AudioModule);
      wasGrantedBefore = !!current?.granted;
    }
  } catch {
    // Best-effort. A failure here just means we apply the warmup
    // delay unnecessarily — annoying for repeat taps but not broken.
  }

  const perm = await AudioModule.requestRecordingPermissionsAsync();
  if (!perm.granted) {
    const status = String(perm.status ?? "").toLowerCase();
    const canAskAgain = perm.canAskAgain !== false;
    return {
      ok: false,
      reason: status === "denied" || !canAskAgain ? "denied" : "unavailable",
      canAskAgain,
    };
  }

  if (!wasGrantedBefore) {
    // Fresh grant — let the audio session activate before the caller
    // hands control to recorder.record(). 400ms is the empirical sweet
    // spot on iPhone 17 Pro (anything under 250ms still drops the first
    // ~0.5s of audio, anything over 600ms feels laggy).
    await new Promise<void>((resolve) => setTimeout(resolve, WARMUP_MS));
  }

  return { ok: true };
}

export async function ensureMicReady(): Promise<boolean> {
  return (await ensureMicPermission()).ok;
}
