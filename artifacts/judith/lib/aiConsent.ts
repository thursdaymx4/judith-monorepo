/**
 * AI consent storage. One persistent flag per device for the whole app —
 * any AI surface that sends user data off-device (Ask Judith, receipt scan,
 * onboarding screenshot scan) gates on this.
 *
 * Bumping the version key forces a re-prompt for every existing user. We do
 * that whenever the consent disclosure changes meaningfully (e.g. a new
 * third-party processor is added) so users see the updated copy.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const AI_CONSENT_KEY = "judith.aiDisclosureConsent.v3";

export async function hasAiConsented(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(AI_CONSENT_KEY);
    return value === "1";
  } catch {
    // Storage error — treat as not consented so the user is re-prompted.
    return false;
  }
}

export async function setAiConsented(consented: boolean): Promise<void> {
  try {
    if (consented) {
      await AsyncStorage.setItem(AI_CONSENT_KEY, "1");
    } else {
      await AsyncStorage.removeItem(AI_CONSENT_KEY);
    }
  } catch {
    // Best-effort. If storage fails we'll re-prompt next time the surface
    // is used — annoying but harmless.
  }
}
