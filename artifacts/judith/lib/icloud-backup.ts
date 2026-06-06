/**
 * iCloud Documents backup for Judith.
 *
 * Backs up the persisted store to the user's private iCloud container
 * (iCloud.com.app.judith). Apple encrypts iCloud Documents at rest with
 * AES-128 and in transit with TLS — only the user's Apple ID can access them.
 *
 * - Backup is best-effort: all failures are silently swallowed.
 * - Restore only runs when local AsyncStorage is empty (fresh install / reinstall).
 * - Each backup is tagged with the Supabase userId so accounts never cross-pollute.
 */

import { Platform } from "react-native";

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
    await cs.writeFile(path, JSON.stringify(envelope), { override: true });
  } catch {
    // Best-effort — never block the app
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
    const envelope = JSON.parse(raw) as BackupEnvelope;
    if (envelope.userId !== userId) return null;
    if (typeof envelope.data !== "object" || !envelope.data) return null;
    return envelope.data as object;
  } catch {
    return null;
  }
}
