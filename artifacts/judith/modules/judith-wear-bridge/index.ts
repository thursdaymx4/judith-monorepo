/**
 * JudithWearBridge — hands the bill payload JSON + a server-signed watch token
 * to a paired Wear OS watch over the Google Wear Data Layer. This is the
 * Android analog of iOS's WatchConnectivity `updateApplicationContext`: the
 * standalone Wear app caches what it receives and uses the token to refresh
 * via the backend (`/watch-summary`) and to run Ask / Mark-paid.
 *
 * Data Layer contract (must match android-native/wear/.../Config.kt):
 *   path:        "/judith/watch-payload"
 *   keys:        "judith_payload_v2" (String) · "judith_watch_token" (String)
 *                · "updated_at" (Long, set natively)
 *
 * Safe to call on iOS and in Expo Go — no-ops silently (Android-only native).
 */
import { Platform } from "react-native";

type WatchMessageEvent = { json: string };

type WearBridge = {
  pushToWatch: (payloadJson: string, token: string | null) => Promise<boolean>;
  addListener: (
    event: "onWatchMessage",
    listener: (payload: WatchMessageEvent) => void,
  ) => { remove: () => void };
};

/** An action the watch sent back to the phone over the Wear Data Layer. */
export interface WatchMessage {
  action: string;
  billId?: string;
  snoozeUntil?: string;
  /** For action "applyActions": a JSON-encoded array of Judith actions from
   *  /watch-ask, applied verbatim via the phone's applyJudithAction. */
  payload?: string;
}

let _bridge: WearBridge | null | undefined;

function getBridge(): WearBridge | null {
  if (_bridge !== undefined) return _bridge;
  if (Platform.OS !== "android") {
    _bridge = null;
    return _bridge;
  }
  try {
    // requireOptionalNativeModule returns null (not throws) when the native
    // module is absent — safe for Expo Go and dev clients without the module.
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => WearBridge | null;
    };
    _bridge = requireOptionalNativeModule("JudithWearBridge") ?? null;
  } catch {
    _bridge = null;
  }
  return _bridge;
}

/**
 * Push the WatchPayload JSON (the same string used for iOS WatchConnectivity)
 * plus the watch token to a paired Wear OS watch. Pass `null` for the token if
 * one could not be provisioned — the watch keeps any token it already holds.
 *
 * No-ops on iOS / Expo Go / when no watch is paired or Play Services is absent.
 */
export async function pushToWatch(
  payloadJson: string,
  token: string | null,
): Promise<void> {
  try {
    await getBridge()?.pushToWatch(payloadJson, token ?? null);
  } catch {
    // No paired watch, no Play Services, or module absent — silent no-op.
  }
}

/**
 * Subscribe to action messages the Wear OS watch sends back to the phone
 * (mark paid / snooze). The phone updates its own store in response — the
 * Android analog of the iOS WCSession message channel. Returns an unsubscribe
 * handle, or null on iOS / when the native module is absent.
 */
export function addWatchMessageListener(
  cb: (msg: WatchMessage) => void,
): { remove: () => void } | null {
  const bridge = getBridge();
  if (!bridge?.addListener) return null;
  return bridge.addListener("onWatchMessage", (payload) => {
    try {
      cb(JSON.parse(payload.json) as WatchMessage);
    } catch {
      // Malformed message — ignore.
    }
  });
}
