/**
 * Receipt-scan router. On-device first, server fallback only when needed.
 *
 * Order of preference:
 *   1. Apple Vision (judith-receipt-vision native module) — runs OCR + amount
 *      / date / merchant heuristics on-device. No image leaves the phone.
 *   2. Server fallback (`/api/judith/receipt-scan` via Claude Vision) — only
 *      when the on-device path is unavailable (Android, Expo Go, pre-iOS-13)
 *      OR returned a low-confidence result we can't trust.
 *
 * Privacy: the server path is opt-in by failure. If Vision says "confidence
 * ≥ MIN_CONFIDENCE", the image never leaves the device.
 */
import * as ReceiptVision from "judith-receipt-vision";
import { scanReceiptViaServer } from "@/lib/proxy";

export type ScanSource = "on-device" | "server-fallback";

export interface ScannedReceipt {
  provider: string | null;
  amount: number | null;
  /** YYYY-MM-DD in the device's local timezone. */
  date: string | null;
  /** ISO 4217 (e.g. "USD"). Null when no currency token was found. */
  currencyHint: string | null;
  /** 0..1 — only the on-device path emits a real score; server returns 1. */
  confidence: number;
  source: ScanSource;
}

/**
 * Confidence threshold below which we ignore the on-device result and ask
 * the server. Tuned so a missing amount (the heaviest signal) always triggers
 * the fallback even if provider+date came through.
 */
const MIN_CONFIDENCE = 0.5;

/**
 * Run the full receipt-scan pipeline against a single image. Returns a
 * canonical result regardless of which backend produced it.
 *
 * Throws only if BOTH the on-device path and the server fallback fail. UI
 * callers should treat an empty/null result as "we couldn't read that —
 * try a clearer photo".
 */
export async function scanReceipt(
  imageBase64: string,
  mimeType: string,
): Promise<ScannedReceipt> {
  const deviceAvailable = await ReceiptVision.isAvailable();
  if (deviceAvailable) {
    const result = await ReceiptVision.recognize(imageBase64, mimeType);
    if (result && result.confidence >= MIN_CONFIDENCE) {
      return {
        provider: result.provider,
        amount: result.amount,
        date: result.date,
        currencyHint: result.currencyHint,
        confidence: result.confidence,
        source: "on-device",
      };
    }
    // Low-confidence on-device result — fall through to server. The image
    // hasn't been uploaded yet at this point.
  }

  const server = await scanReceiptViaServer(imageBase64, mimeType);
  return {
    provider: server.provider,
    amount: server.amount,
    date: server.date,
    currencyHint: server.currencyHint,
    confidence: 1,
    source: "server-fallback",
  };
}
