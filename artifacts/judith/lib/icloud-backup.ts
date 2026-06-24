/**
 * iCloud Documents backup for Judith.
 *
 * Stores **multiple timestamped snapshots** in the user's private iCloud
 * container (iCloud.com.app.judith) so the user can restore from any of
 * the recent saves, not just the latest. Snapshots are encrypted before
 * write — the iCloud file never contains plaintext bill data.
 *
 * Layout on disk:
 *   iCloud.com.app.judith/Documents/
 *     judith_backup_v1.json                       (legacy, single-file)
 *     backups/
 *       snapshot_2026-06-24T14-30-45-123Z.json    (new multi-snapshot)
 *       snapshot_2026-06-24T15-30-45-678Z.json
 *
 * - Backup is best-effort: all failures are silently swallowed.
 * - Restore only runs when local AsyncStorage is empty (fresh install / reinstall).
 * - Each backup is tagged with the Supabase userId so accounts never cross-pollute.
 * - Retention: after each successful save, prune to the most recent
 *   {@link SNAPSHOT_RETENTION} snapshots for THIS user. The legacy V1 file is
 *   left in place so older builds can still read their own backup if the user
 *   downgrades — it's just not written to anymore.
 */

import { NativeModules, Platform } from "react-native";
import { parseProtectedObject, serializeProtectedObject } from "@/lib/securePersist";

const LEGACY_FILENAME = "judith_backup_v1.json";
const SNAPSHOT_DIR = "backups";
const SNAPSHOT_PREFIX = "snapshot_";
const SNAPSHOT_SUFFIX = ".json";
/** Keep at most this many timestamped snapshots per device. */
const SNAPSHOT_RETENTION = 10;

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
  readDir?: (path: string) => Promise<string[]>;
  createDir?: (path: string) => Promise<void>;
  unlink?: (path: string) => Promise<void>;
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

function documentsPath(cs: CloudStoreModule): string | null {
  const base = cs.defaultICloudContainerPath;
  if (!base) return null;
  return `${base}/Documents`;
}

function legacyPath(cs: CloudStoreModule): string | null {
  const docs = documentsPath(cs);
  if (!docs) return null;
  return `${docs}/${LEGACY_FILENAME}`;
}

function snapshotDirPath(cs: CloudStoreModule): string | null {
  const docs = documentsPath(cs);
  if (!docs) return null;
  return `${docs}/${SNAPSHOT_DIR}`;
}

function buildSnapshotPath(cs: CloudStoreModule, savedAt: string): string | null {
  const dir = snapshotDirPath(cs);
  if (!dir) return null;
  // ISO has ":" which is safe in iCloud paths but not in many other places — we
  // also want filenames that sort chronologically and round-trip cleanly. Swap
  // colons + dots for dashes; the resulting filename is monotonic by lex sort.
  const safe = savedAt.replace(/[:.]/g, "-");
  return `${dir}/${SNAPSHOT_PREFIX}${safe}${SNAPSHOT_SUFFIX}`;
}

/** Extract the ISO timestamp portion of a snapshot filename. */
function timestampFromFilename(filename: string): string | null {
  if (!filename.startsWith(SNAPSHOT_PREFIX)) return null;
  if (!filename.endsWith(SNAPSHOT_SUFFIX)) return null;
  return filename.slice(SNAPSHOT_PREFIX.length, -SNAPSHOT_SUFFIX.length);
}

interface BackupEnvelope {
  version: number;
  userId: string;
  savedAt: string;
  data: unknown;
}

/**
 * Public summary of a single backup snapshot, returned by
 * {@link listICloudBackups}. Used by the UI to render a chooser.
 */
export interface BackupSummary {
  /** Stable identifier for {@link loadICloudBackup}.
   *  - For V2 snapshots: the filename without extension
   *  - For the legacy V1 single-file: the string `"legacy_v1"` */
  key: string;
  /** ISO timestamp the snapshot was written. */
  savedAt: string;
  /** Number of bills inside this snapshot's data payload. */
  billCount: number;
  /** Whether the user's display name was set at the time of this snapshot. */
  hasName: boolean;
  /** True if this is the legacy single-file backup from older builds. */
  legacy: boolean;
}

/**
 * Make sure the snapshot directory exists. iCloud's createDir is a no-op
 * if the directory is already there.
 */
async function ensureSnapshotDir(cs: CloudStoreModule): Promise<string | null> {
  const dir = snapshotDirPath(cs);
  if (!dir || !cs.createDir) return dir;
  try {
    await cs.createDir(dir);
  } catch {
    // Probably already exists, or the user has iCloud Drive turned off — both
    // are non-fatal here; the writeFile call below will surface a real error.
  }
  return dir;
}

/**
 * Write a fresh timestamped snapshot to iCloud and prune older ones.
 * Called from JudithStore after every debounced save (authenticated users only).
 */
export async function saveToICloud(
  data: object,
  userId: string,
): Promise<void> {
  if (!userId) return;
  if (!(await available())) return;
  const cs = getCS()!;
  await ensureSnapshotDir(cs);
  const savedAt = new Date().toISOString();
  const path = buildSnapshotPath(cs, savedAt);
  if (!path) return;
  try {
    const envelope: BackupEnvelope = {
      version: 2,
      userId,
      savedAt,
      data,
    };
    const payload = await serializeProtectedObject(envelope);
    await cs.writeFile(path, payload, { override: true });
  } catch {
    // Best-effort — never block the app
    return;
  }
  // After a successful write, trim old snapshots. We deliberately do this
  // AFTER the new file lands so a power-cut between unlink + write can never
  // leave the user with fewer backups than expected.
  void pruneICloudBackups(userId).catch(() => {});
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
 * Read one envelope and validate it belongs to the current user. Returns
 * the BackupSummary for the file, or null if the envelope is foreign /
 * unreadable / mis-shaped.
 */
async function summarizeEnvelope(
  cs: CloudStoreModule,
  path: string,
  userId: string,
  opts: { legacy: boolean; key: string },
): Promise<BackupSummary | null> {
  try {
    const exists = await cs.exist(path);
    if (!exists) return null;
    const raw = await cs.readFile(path);
    const envelope = await parseProtectedObject<BackupEnvelope>(raw);
    if (!envelope) return null;
    if (envelope.userId !== userId) return null;
    const data = envelope.data as { bills?: unknown[]; name?: string } | undefined;
    const billCount = Array.isArray(data?.bills) ? data!.bills!.length : 0;
    const hasName = typeof data?.name === "string" && data.name.trim().length > 0;
    return {
      key: opts.key,
      savedAt: envelope.savedAt ?? new Date().toISOString(),
      billCount,
      hasName,
      legacy: opts.legacy,
    };
  } catch {
    return null;
  }
}

/**
 * List every backup snapshot iCloud has for this account, newest first.
 * Combines:
 *   - The legacy single-file backup (`judith_backup_v1.json`), if present.
 *   - All timestamped snapshots in `Documents/backups/`.
 *
 * Snapshots belonging to a different userId are silently filtered out so
 * the chooser only ever shows the user their own data.
 */
export async function listICloudBackups(userId: string): Promise<BackupSummary[]> {
  if (!userId) return [];
  if (!(await available())) return [];
  const cs = getCS()!;
  const docs = documentsPath(cs);
  if (!docs) return [];

  const results: BackupSummary[] = [];

  // Legacy single-file path. Older builds (and the very first save after
  // upgrading from V1 to V2) might leave a file here.
  const lp = legacyPath(cs);
  if (lp) {
    const summary = await summarizeEnvelope(cs, lp, userId, {
      legacy: true,
      key: "legacy_v1",
    });
    if (summary) results.push(summary);
  }

  // V2 timestamped snapshots
  const dir = snapshotDirPath(cs);
  if (dir && cs.readDir) {
    try {
      // react-native-cloud-store's readDir returns either bare filenames or
      // full paths depending on the build. Normalize to bare filenames.
      const entries = await cs.readDir(dir);
      const filenames = entries
        .map((e) => e.split("/").pop() ?? e)
        .filter((n) => n.startsWith(SNAPSHOT_PREFIX) && n.endsWith(SNAPSHOT_SUFFIX));

      const summaries = await Promise.all(
        filenames.map((fn) => {
          const key = fn.slice(0, -SNAPSHOT_SUFFIX.length);
          return summarizeEnvelope(cs, `${dir}/${fn}`, userId, {
            legacy: false,
            key,
          });
        }),
      );
      for (const s of summaries) if (s) results.push(s);
    } catch {
      // best-effort — directory may not exist yet on a fresh install
    }
  }

  results.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  return results;
}

/**
 * Load a specific backup by its `key` (from {@link listICloudBackups}).
 * Returns the data payload (not the envelope) so callers can splat into state.
 */
export async function loadICloudBackup(
  userId: string,
  key: string,
): Promise<object | null> {
  if (!userId || !key) return null;
  if (!(await available())) return null;
  const cs = getCS()!;
  let path: string | null;
  if (key === "legacy_v1") {
    path = legacyPath(cs);
  } else {
    const dir = snapshotDirPath(cs);
    path = dir ? `${dir}/${key}${SNAPSHOT_SUFFIX}` : null;
  }
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

/**
 * Delete old snapshots so the user's iCloud Documents folder doesn't grow
 * unbounded. Keeps the {@link SNAPSHOT_RETENTION} most recent files (per
 * userId) and removes everything else that's clearly ours.
 */
export async function pruneICloudBackups(userId: string): Promise<void> {
  if (!userId) return;
  if (!(await available())) return;
  const cs = getCS()!;
  const dir = snapshotDirPath(cs);
  if (!dir || !cs.readDir || !cs.unlink) return;
  try {
    const entries = await cs.readDir(dir);
    const mine: { filename: string; ts: string }[] = [];
    for (const e of entries) {
      const fn = e.split("/").pop() ?? e;
      if (!fn.startsWith(SNAPSHOT_PREFIX) || !fn.endsWith(SNAPSHOT_SUFFIX)) continue;
      // We only know a file is ours by reading its envelope. Cheap enough at
      // <=20 files; if listings ever grow huge we can switch to a cached index.
      try {
        const raw = await cs.readFile(`${dir}/${fn}`);
        const env = await parseProtectedObject<BackupEnvelope>(raw);
        if (env?.userId === userId) {
          const ts = timestampFromFilename(fn) ?? env.savedAt ?? "";
          mine.push({ filename: fn, ts });
        }
      } catch { /* skip unreadable file */ }
    }
    mine.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    const stale = mine.slice(SNAPSHOT_RETENTION);
    for (const f of stale) {
      try { await cs.unlink(`${dir}/${f.filename}`); } catch { /* best-effort */ }
    }
  } catch {
    // best-effort
  }
}

/**
 * Full diagnostic snapshot for the Settings -> Account -> iCloud Diagnostics
 * row. Surfaces every silent-failure mode we've hit in TestFlight so a
 * tester can tell us exactly which one they're in:
 *   - status          : the overall reachability tier
 *   - containerPath   : where iCloud would look for the file (null if not configured)
 *   - fileExists      : does the file exist on disk yet (false often = sync still pending)
 *   - envelopeUserId  : the user.id baked into the envelope of the LATEST backup
 *   - userIdMatches   : true iff envelope.userId === current user.id
 *   - savedAt         : the timestamp on the LATEST envelope
 *   - backupCount     : how many snapshots exist for this user
 */
export async function getICloudDiagnostics(userId: string | undefined): Promise<{
  status: ICloudStatus;
  containerPath: string | null;
  fileExists: boolean;
  envelopeUserId: string | null;
  userIdMatches: boolean;
  savedAt: string | null;
  backupCount: number;
}> {
  const status = await getICloudStatus();
  const cs = getCS();
  const containerPath = cs?.defaultICloudContainerPath ?? null;
  let fileExists = false;
  let envelopeUserId: string | null = null;
  let savedAt: string | null = null;
  let backupCount = 0;
  if (status === "ok" && userId) {
    try {
      const list = await listICloudBackups(userId);
      backupCount = list.length;
      if (list.length > 0) {
        fileExists = true;
        envelopeUserId = userId;
        savedAt = list[0].savedAt;
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
    backupCount,
  };
}

/**
 * Read the latest envelope's metadata without applying it. Used by Settings to
 * show "Last backup: 5 minutes ago" so the user can confirm their data is safe.
 * Returns null if iCloud is off, no backup exists, or the envelope belongs
 * to a different userId.
 */
export async function getICloudInfo(
  userId: string,
): Promise<{ savedAt: string } | null> {
  if (!userId) return null;
  const list = await listICloudBackups(userId);
  if (list.length === 0) return null;
  return { savedAt: list[0].savedAt };
}

/**
 * Peek at the **latest** iCloud backup envelope without applying it. Returns
 * metadata only — the calling UI uses this to render a "We found a backup
 * from [date]" prompt before deciding whether to restore. Returns null when
 * no backup exists for this userId.
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

  // listICloudBackups handles both V1 + V2 and filters by userId.
  // Retry the listing — fresh installs sometimes need a moment for the
  // iCloud Drive descriptor to surface even after available() returned true.
  let list: BackupSummary[] = [];
  for (const wait of [0, 500, 1500, 3000]) {
    if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
    list = await listICloudBackups(userId);
    if (list.length > 0) break;
  }
  if (list.length === 0) return null;
  const newest = list[0];
  return {
    savedAt: newest.savedAt,
    billCount: newest.billCount,
    hasName: newest.hasName,
  };
}

/**
 * Try to restore the LATEST backup from iCloud.
 * Returns the stored data object if a backup exists for this userId,
 * or null if unavailable / not found / wrong user.
 *
 * Equivalent to {@link loadICloudBackup} with the newest key from
 * {@link listICloudBackups} — kept as a separate export because the
 * cold-launch path and the WelcomeBackSheet still default to "latest".
 */
export async function loadFromICloud(userId: string): Promise<object | null> {
  if (!userId) return null;
  if (!(await available())) return null;
  const list = await listICloudBackups(userId);
  if (list.length === 0) return null;
  return loadICloudBackup(userId, list[0].key);
}
