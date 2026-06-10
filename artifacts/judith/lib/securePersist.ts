import { NativeModules, Platform } from "react-native";

const ENCRYPTED_PREFIX = "judith-secure-v1:";

type JudithSecureStoreModule = {
  encryptString(value: string): Promise<string>;
  decryptString(value: string): Promise<string>;
};

let secureStoreModule: JudithSecureStoreModule | null = null;

function getSecureStoreModule(): JudithSecureStoreModule | null {
  if (secureStoreModule !== null) return secureStoreModule;
  if (Platform.OS !== "ios") return null;

  try {
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (
        name: string,
      ) => JudithSecureStoreModule | null;
    };
    secureStoreModule =
      requireOptionalNativeModule("JudithSecureStore") ??
      (NativeModules.JudithSecureStore as JudithSecureStoreModule | undefined) ??
      null;
  } catch {
    secureStoreModule =
      (NativeModules.JudithSecureStore as JudithSecureStoreModule | undefined) ??
      null;
  }

  return secureStoreModule;
}

export async function serializeProtectedObject(value: unknown): Promise<string> {
  const json = JSON.stringify(value);
  const module = getSecureStoreModule();
  if (!module) return json;

  const ciphertext = await module.encryptString(json);
  return `${ENCRYPTED_PREFIX}${ciphertext}`;
}

export async function parseProtectedObject<T>(raw: string | null): Promise<T | null> {
  if (!raw) return null;

  if (!raw.startsWith(ENCRYPTED_PREFIX)) {
    return JSON.parse(raw) as T;
  }

  const module = getSecureStoreModule();
  if (!module) return null;

  const decrypted = await module.decryptString(raw.slice(ENCRYPTED_PREFIX.length));
  return JSON.parse(decrypted) as T;
}
