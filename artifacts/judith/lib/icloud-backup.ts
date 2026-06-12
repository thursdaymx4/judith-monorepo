/**
 * iCloud Documents backup for Judith.
 *
 * Backs up the persisted store to the user's private iCloud container
 * (iCloud.com.app.judith). The app encrypts the backup payload before writing
 * it, so the iCloud file never contains plaintext bill data.
 *
 * - Backup is best-effort: all failures are silently swallowed.
 * - Restore only runs when local AsyncStorage is empty (fresh install / reinstall).
 * - Each backup is tagged with the Supabase userId so accounts never cross-pollute.
 */

import { NativeModules, Platform } from "react-native";
import { parseProtectedObject, serializeProtectedObject } from "@/lib/securePersist";

const BACKUP_FILENAME = "judith_backup_v1.json";

// Lazy-load so Expo Go (which lacks the native module) doesn't crash.
type CloudStoreModule = {
  isICloudAvailable: () => Promise<boolean>;
  defaultICloudContainerPath: string | undefined;
  writeFile: (
    path: string,
    content: string,
    options?: { override?: boolean },
  ) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  exist: (path: string) => Promise<boolean>;
};

let _cs: CloudStoreModule | null = null;
function getCS(): CloudStoreModule | null {
  if (_cs) return _cs;
  // Guard: if the native module isn't registered (Expo Go, Android),
  // skip require() entirely — the package throws on import when unlinked.
  if (!NativeModules.CloudStoreModule) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _cs = require("react-native-cloud-store") as CloudStoreModule;
  } catch {
    _cs = null;
  }
  return _cs;
}

async function available(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  const cs = getCS();
  if (!cs) return false;
  try {
    return await cs.isICloudAvailable();
  } catch {
    return false;
  }
}

function backupPath(cs: CloudStoreModule): string | null {
  const base = cs.defaultICloudContainerPath;
  if (!base) return null;
  return `${base}/Documents/${BACKUP_FILENAME}`;
}

interface BackupEnvelope {
  version: number;
  userId: string;
  savedAt: string;
  data: unknown;
}

/**
 * Write the current store snapshot to iCloud.
 * Called from JudithStore after every debounced save (authenticated users only).
 */
export async function saveToICloud(
  data: object,
  userId: string,
): Promise<void> {
  if (!userId) return;
  if (!(await available())) return;
  const cs = getCS()!;
  const path = backupPath(cs);
  if (!path) return;
  try {
    const envelope: BackupEnvelope = {
      version: 1,
      userId,
      savedAt: new Date().toISOString(),
      data,
    };
    const payload = await serializeProtectedObject(envelope);
    await cs.writeFile(path, payload, { override: true });
  } catch {
    // Best-effort — never block the app
  }
}

/**
 * Public status check for the Settings UI: is iCloud reachable on this
 * device? Used to render the backup row's availability pill.
 */
export async function isICloudAvailable(): Promise<boolean> {
  return available();
}

/**
 * Read the envelope metadata without applying it. Used by Settings to show
 * "Last backup: 5 minutes ago" so the user can confirm their data is safe.
 * Returns null if iCloud is off, no backup exists, or the envelope belongs
 * to a different userId.
 */
export async function getICloudInfo(
  userId: string,
): Promise<{ savedAt: string } | null> {
  if (!userId) return null;
  if (!(await available())) return null;
  const cs = getCS()!;
  const path = backupPath(cs);
  if (!path) return null;
  try {
    const exists = await cs.exist(path);
    if (!exists) return null;
    const raw = await cs.readFile(path);
    const envelope = await parseProtectedObject<BackupEnvelope>(raw);
    if (!envelope) return null;
    if (envelope.userId !== userId) return null;
    return { savedAt: envelope.savedAt };
  } catch {
    return null;
  }
}

/**
 * Try to restore a backup from iCloud.
 * Returns the stored data object if a backup exists for this userId,
 * or null if unavailable / not found / wrong user.
 */
export async function loadFromICloud(userId: string): Promise<object | null> {
  if (!userId) return null;
  if (!(await available())) return null;
  const cs = getCS()!;
  const path = backupPath(cs);
  if (!path) return null;
  try {
    const exists = await cs.exist(path);
    if (!exists) return null;
    const raw = await cs.readFile(path);
    const envelope = await parseProtectedObject<BackupEnvelope>(raw);
    if (!envelope) return null;
    if (envelope.userId !== userId) return null;
    if (typeof envelope.data !== "object" || !envelope.data) return null;
    return envelope.data as object;
  } catch {
    return null;
  }
}
