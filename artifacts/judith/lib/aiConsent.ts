/**
 * AI consent storage — tri-state per device.
 *
 *   "unknown"  → never asked; surface the modal on the next AI surface
 *   "accepted" → AI features enabled
 *   "declined" → AI features disabled; do NOT re-prompt
 *
 * The tri-state matters: a binary boolean would re-prompt on every screen
 * after a decline, which the user (rightly) called out as annoying.
 *
 * Bumping the version key forces a re-prompt for every existing user. v4
 * rewrites the disclosure into an Apple-style "Allow / Don't Allow" sheet
 * with bulleted data lists, after Apple's repeated 5.1.1(i) review feedback.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const AI_CONSENT_KEY = "judith.aiDisclosureConsent.v4";

export type AiConsentStatus = "unknown" | "accepted" | "declined";

export async function getAiConsentStatus(): Promise<AiConsentStatus> {
  try {
    const v = await AsyncStorage.getItem(AI_CONSENT_KEY);
    if (v === "1") return "accepted";
    if (v === "0") return "declined";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function hasAiConsented(): Promise<boolean> {
  return (await getAiConsentStatus()) === "accepted";
}

export async function setAiConsentStatus(status: AiConsentStatus): Promise<void> {
  try {
    if (status === "accepted") {
      await AsyncStorage.setItem(AI_CONSENT_KEY, "1");
    } else if (status === "declined") {
      await AsyncStorage.setItem(AI_CONSENT_KEY, "0");
    } else {
      await AsyncStorage.removeItem(AI_CONSENT_KEY);
    }
  } catch {
    // Best-effort. If storage fails the next launch may re-prompt — minor.
  }
}

// Backwards-compat: callers that still use the old boolean setter map onto
// the tri-state. true → accepted, false → unknown (the old semantics: clear
// the marker). Use setAiConsentStatus directly to record a hard decline.
export async function setAiConsented(consented: boolean): Promise<void> {
  await setAiConsentStatus(consented ? "accepted" : "unknown");
}
