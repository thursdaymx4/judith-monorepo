/**
 * JudithWidgetBridge — writes the bill payload JSON to the iOS App Group
 * (group.com.app.judith / UserDefaults key "judith.payload_v2") and triggers
 * WidgetCenter.reloadAllTimelines() so the homescreen and lockscreen widgets
 * refresh immediately.
 *
 * Safe to call on Android and in Expo Go — no-ops silently.
 */
import { NativeModules, Platform } from "react-native";

type Bridge = { writePayload: (json: string) => void };

let _bridge: Bridge | null = null;

function getBridge(): Bridge | null {
  if (_bridge !== null) return _bridge;
  if (Platform.OS !== "ios") return null;
  try {
    // requireOptionalNativeModule returns null (not throws) when the native
    // module is absent — safe for Expo Go and non-iOS.
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => Bridge | null;
    };
    _bridge =
      requireOptionalNativeModule("JudithWidgetBridge") ??
      (NativeModules.JudithWidgetBridge as Bridge | undefined) ??
      null;
  } catch {
    _bridge = (NativeModules.JudithWidgetBridge as Bridge | undefined) ?? null;
  }
  return _bridge;
}

/**
 * Write the WatchPayload JSON string to the shared App Group and reload widget
 * timelines. Pass the same payload JSON used for WatchConnectivity sync.
 */
export function writePayload(json: string): void {
  getBridge()?.writePayload(json);
}
