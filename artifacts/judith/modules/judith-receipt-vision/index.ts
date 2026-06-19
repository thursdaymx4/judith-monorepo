/**
 * JudithReceiptVision — on-device OCR + heuristic extraction of bill-payment
 * details from a receipt image using Apple's Vision framework. iOS 13+ only.
 *
 * Privacy invariant: the image stays on-device. The Swift side runs Vision
 * locally, then runs amount/date/merchant heuristics on the OCR text. Only
 * the small extracted summary crosses the React Native bridge.
 *
 * Callers should check `isAvailable()` first and fall through to the server
 * fallback (`scanReceiptViaServer`) whenever this returns unavailability OR
 * a low-confidence result.
 */
import { NativeModules, Platform } from "react-native";

export interface ReceiptScanResult {
  /** Merchant / biller name as printed on the receipt. */
  provider: string | null;
  /** Total amount paid as a plain number. */
  amount: number | null;
  /** Transaction date as YYYY-MM-DD in the device's local timezone. */
  date: string | null;
  /**
   * 0..1. Higher = clearer signal (e.g. a "Total" line was found, a date
   * was extracted, a merchant line was at the top of the receipt). Callers
   * use this to decide whether to fall back to the server pipeline.
   */
  confidence: number;
}

/**
 * Payload the iOS Share Extension drops into the App Group when the user
 * shares an image into Judith from Photos / Safari / a screenshot. The host
 * app pulls + clears it on the next mount of the receipt-scan screen.
 */
export interface PendingShare {
  id: string;
  base64: string;
  mime: string;
  /** Unix seconds the share happened. Used to age-out stale handoffs. */
  createdAt: number;
}

interface NativeModuleShape {
  isAvailable(): Promise<boolean>;
  recognize(imageBase64: string, mimeType: string): Promise<ReceiptScanResult>;
  consumePendingShare(): Promise<PendingShare | null>;
}

const RV = (NativeModules.JudithReceiptVisionModule ?? null) as NativeModuleShape | null;

/**
 * True on iOS 13+ devices where Vision is linkable. Always false on Android,
 * Expo Go, and pre-iOS-13.
 */
export async function isAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || !RV) return false;
  try {
    return await RV.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Run Vision OCR + heuristic extraction on the given image. Returns
 * `null` when the native module isn't linked (Android, Expo Go) — callers
 * MUST handle null by falling back to the server pipeline.
 */
export async function recognize(
  imageBase64: string,
  mimeType: string,
): Promise<ReceiptScanResult | null> {
  if (Platform.OS !== "ios" || !RV) return null;
  try {
    return await RV.recognize(imageBase64, mimeType);
  } catch {
    return null;
  }
}

/**
 * Returns the most recent image shared into Judith from the iOS Share
 * Extension, if any, AND clears it from the App Group so the same payload
 * isn't replayed on the next mount. Returns null on Android, Expo Go, or
 * when nothing has been shared.
 */
export async function consumePendingShare(): Promise<PendingShare | null> {
  if (Platform.OS !== "ios" || !RV) return null;
  try {
    return await RV.consumePendingShare();
  } catch {
    return null;
  }
}
