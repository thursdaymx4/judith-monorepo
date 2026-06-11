/**
 * JudithSecureStore — iOS Keychain-backed secure storage + AES-GCM helpers.
 *
 * The native module (Name: "JudithSecureStore") is autolinked via
 * expo-module.config.json, so it survives clean prebuilds / EAS builds.
 * It is consumed through requireOptionalNativeModule("JudithSecureStore") in
 * lib/securePersist.ts, which safely no-ops on Android / Expo Go where the
 * native module is absent.
 */
export {};
