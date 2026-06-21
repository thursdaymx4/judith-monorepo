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
 * Diagnostic snapshot of what's actually happening with iCloud on this
 * device. Surfaces the silent-failure modes so the Settings screen can
 * tell the user WHY backup isn't working instead of just saying "off".
 *
 * Returns one of:
 *   - "ok"           → iCloud Drive on, container reachable, ready to write
 *   - "ios-only"     → running on Android / web (no backup expected)
 *   - "missing-module" → react-native-cloud-store wasn't autolinked
 *   - "no-drive"     → user has iCloud Drive turned off / signed out
 *   - "no-container" → entitlements/Info.plist not declaring the container
 */
export type ICloudStatus =
  | "ok"
  | "ios-only"
  | "missing-module"
  | "no-drive"
  | "no-container";

export async function getICloudStatus(): Promise<ICloudStatus> {
  if (Platform.OS !== "ios") return "ios-only";
  const cs = getCS();
  if (!cs) return "missing-module";
  try {
    const driveOn = await cs.isICloudAvailable();
    if (!driveOn) return "no-drive";
  } catch {
    return "no-drive";
  }
  if (!cs.defaultICloudContainerPath) return "no-container";
  return "ok";
}

/**
 * Full diagnostic snapshot for the Settings -> Account -> iCloud Diagnostics
 * row. Surfaces every silent-failure mode we've hit in TestFlight so a
 * tester can tell us exactly which one they're in:
 *   - status          : the overall reachability tier
 *   - containerPath   : where iCloud would look for the file (null if not configured)
 *   - fileExists      : does the file exist on disk yet (false often = sync still pending)
 *   - envelopeUserId  : the user.id baked into the file's envelope, when readable
 *   - userIdMatches   : true iff envelope.userId === current user.id
 *   - savedAt         : the timestamp on the envelope
 */
export async function getICloudDiagnostics(userId: string | undefined): Promise<{
  status: ICloudStatus;
  containerPath: string | null;
  fileExists: boolean;
  envelopeUserId: string | null;
  userIdMatches: boolean;
  savedAt: string | null;
}> {
  const status = await getICloudStatus();
  const cs = getCS();
  const containerPath = cs?.defaultICloudContainerPath ?? null;
  const path = cs ? backupPath(cs) : null;
  let fileExists = false;
  let envelopeUserId: string | null = null;
  let savedAt: string | null = null;
  if (status === "ok" && cs && path) {
    try {
      fileExists = await cs.exist(path);
      if (fileExists) {
        const raw = await cs.readFile(path);
        const envelope = await parseProtectedObject<BackupEnvelope>(raw);
        if (envelope) {
          envelopeUserId = envelope.userId ?? null;
          savedAt = envelope.savedAt ?? null;
        }
      }
    } catch {
      // best-effort — leave defaults
    }
  }
  return {
    status,
    containerPath,
    fileExists,
    envelopeUserId,
    userIdMatches: !!userId && !!envelopeUserId && envelopeUserId === userId,
    savedAt,
  };
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
 * Peek at the iCloud backup envelope without applying it.
 * Returns metadata only — the calling UI uses this to render a
 * "We found a backup from [date]" prompt before deciding whether to
 * restore. Returns null when no backup exists for this userId.
 *
 * Retries on iCloud-not-available because iCloud Drive takes a beat
 * after app launch to come online, and the hydration peek fires very
 * early. Without the retry a returning user sees no Welcome-Back
 * sheet on the first launch and ends up in onboarding instead.
 */
export async function peekICloudBackup(userId: string): Promise<{
  savedAt: string;
  billCount: number;
  hasName: boolean;
} | null> {
  if (!userId) return null;

  // Extended retry: iCloud Drive sync between uninstalls is occasionally
  // SLOW (saw 6-8s lag in TestFlight). The peek runs after the user has
  // explicitly asked for it (Welcome-Back rehydrate or "Returning user?"
  // tap) — better to wait than to say "no backup" prematurely.
  // Total worst-case ~10s with progressive backoff.
  const delays = [0, 400, 800, 1500, 2500, 3500];
  let ready = false;
  for (const wait of delays) {
    if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
    if (await available()) { ready = true; break; }
  }
  if (!ready) return null;

  // Also retry the file-exists probe — even when iCloud is "available",
  // the document descriptor for the backup file may need a beat to
  // surface after a fresh installation. Three attempts.

  const cs = getCS()!;
  const path = backupPath(cs);
  if (!path) return null;
  try {
    // Retry the exist() probe — fresh installs sometimes need a moment
    // for the iCloud Drive descriptor to surface even after available()
    // returned true.
    let exists = false;
    for (const wait of [0, 500, 1500, 3000]) {
      if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
      exists = await cs.exist(path);
      if (exists) break;
    }
    if (!exists) return null;
    const raw = await cs.readFile(path);
    const envelope = await parseProtectedObject<BackupEnvelope>(raw);
    if (!envelope) return null;
    if (envelope.userId !== userId) return null;
    const data = envelope.data as { bills?: unknown[]; name?: string } | undefined;
    const billCount = Array.isArray(data?.bills) ? data!.bills!.length : 0;
    const hasName = typeof data?.name === "string" && data.name.trim().length > 0;
    return {
      savedAt: envelope.savedAt ?? new Date().toISOString(),
      billCount,
      hasName,
    };
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
