/**
 * Judith local notification system.
 *
 * Works with the store's Bill type (constants/data.ts).
 * Two notification types per unpaid bill:
 *   - Reminder: fires `leadDays` before due date at 9:00 AM (default 3 days)
 *   - Nudge:    fires on the due date at 9:00 AM
 *
 * Identifiers are deterministic so re-scheduling replaces the old one.
 */
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Platform } from "react-native";
import { isPaidViaCard, nextOccurrence, type Bill } from "@/constants/data";
import type { PersonaId } from "@/constants/personas";
import { supabase } from "@/lib/supabase";

// ─── Notification categories ──────────────────────────────────────────────────
// Register once on app start so iOS/Android know about the action buttons.
// "Mark Paid" opens the app; "Remind Tomorrow" can resolve silently.

export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.setNotificationCategoryAsync("BILL_REMINDER", [
    {
      identifier: "pay-now",
      buttonTitle: "Mark Paid",
      options: { opensAppToForeground: true },
    },
    {
      identifier: "remind-tomorrow",
      buttonTitle: "Remind Tomorrow",
      options: { opensAppToForeground: false },
    },
  ]);
}

// Show alerts even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const REMOTE_PUSH_STORAGE_KEY = "judith.remote-push-registration.v1";

interface RemotePushRegistration {
  expoPushToken: string | null;
  devicePushToken: string | null;
  devicePushType: string | null;
  permissionStatus: "granted" | "denied" | "undetermined";
  platform: string;
  projectId: string | null;
  updatedAt: string;
}

function getProjectId(): string | null {
  const easProjectId =
    (Constants.easConfig?.projectId as string | undefined) ??
    ((Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId);
  return easProjectId ?? null;
}

async function readStoredRemotePushRegistration(): Promise<RemotePushRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(REMOTE_PUSH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RemotePushRegistration;
  } catch {
    return null;
  }
}

async function writeStoredRemotePushRegistration(
  registration: RemotePushRegistration,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      REMOTE_PUSH_STORAGE_KEY,
      JSON.stringify(registration),
    );
  } catch {
    // ignore persistence failure
  }
}

function registrationsEqual(
  a: RemotePushRegistration | null,
  b: RemotePushRegistration | null,
): boolean {
  if (!a || !b) return false;
  return (
    a.expoPushToken === b.expoPushToken &&
    a.devicePushToken === b.devicePushToken &&
    a.devicePushType === b.devicePushType &&
    a.permissionStatus === b.permissionStatus &&
    a.platform === b.platform &&
    a.projectId === b.projectId
  );
}

async function registerRemotePushTokens(): Promise<RemotePushRegistration | null> {
  if (Platform.OS === "web") return null;

  const permissionStatus = await getPermissionStatus();
  if (permissionStatus !== "granted") {
    const deniedRegistration: RemotePushRegistration = {
      expoPushToken: null,
      devicePushToken: null,
      devicePushType: null,
      permissionStatus,
      platform: Platform.OS,
      projectId: getProjectId(),
      updatedAt: new Date().toISOString(),
    };
    await writeStoredRemotePushRegistration(deniedRegistration);
    return deniedRegistration;
  }

  let expoPushToken: string | null = null;
  let devicePushToken: string | null = null;
  let devicePushType: string | null = null;
  const projectId = getProjectId();

  try {
    const token = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    expoPushToken = token.data ?? null;
  } catch {
    expoPushToken = null;
  }

  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    devicePushToken =
      typeof deviceToken.data === "string"
        ? deviceToken.data
        : JSON.stringify(deviceToken.data);
    devicePushType = deviceToken.type ?? null;
  } catch {
    devicePushToken = null;
    devicePushType = null;
  }

  const registration: RemotePushRegistration = {
    expoPushToken,
    devicePushToken,
    devicePushType,
    permissionStatus,
    platform: Platform.OS,
    projectId,
    updatedAt: new Date().toISOString(),
  };
  await writeStoredRemotePushRegistration(registration);
  return registration;
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function getPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
  if (Platform.OS === "web") return "denied";
  const { status } = await Notifications.getPermissionsAsync();
  return status as "granted" | "denied" | "undetermined";
}

/**
 * Requests notification permission.
 * If previously denied, shows a user-friendly alert directing them to Settings.
 * Returns true only when permission is granted.
 */
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: current } = await Notifications.getPermissionsAsync();
  if (current === "granted") {
    await syncRemotePushRegistrationToSession().catch(() => {});
    return true;
  }
  if (current === "denied") {
    Alert.alert(
      "Enable notifications",
      'Judith needs notification access to send bill reminders. Go to Settings → Judith → Notifications and turn them on.',
      [{ text: "Got it" }],
    );
    return false;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === "granted") {
    await syncRemotePushRegistrationToSession().catch(() => {});
  }
  return status === "granted";
}

// ─── Notification copy ────────────────────────────────────────────────────────

function pesoStr(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-US")}`;
}

/** Returns true when notifications for this persona should use Filipino copy. */
function useFilipino(persona: PersonaId, language: string): boolean {
  // Only deliver Filipino copy when the user has explicitly chosen Filipino.
  // English users who pick a Filipino-flavoured persona still get English copy.
  return language === "fil";
}

function reminderCopy(
  persona: PersonaId,
  bill: Bill,
  leadDays: number,
  language: string,
  cardName?: string,
): { title: string; body: string } {
  const amt = pesoStr(bill.amount);
  const soon = leadDays === 1 ? "tomorrow" : `in ${leadDays} days`;
  // Card-linked bills are auto-charged, not paid by hand — give a heads-up with
  // a clear clue about which card it lands on.
  if (cardName) return cardLinkedReminderCopy(persona, bill, soon, amt, language, cardName);
  const fil = useFilipino(persona, language);
  switch (persona) {
    case "funny":
      return {
        title: `Heads up — ${bill.provider} 👀`,
        body: `${amt} due ${soon}. Let's not gift them late fees, okay?`,
      };
    case "sib":
      return {
        title: `${bill.provider} — you know what's coming.`,
        body: `${amt} due ${soon}. Pay it before I have to remind you twice.`,
      };
    case "mama":
      return fil
        ? {
            title: `${bill.provider} is due ${soon}`,
            body: `${amt} na lang. Bayaran mo na para wala tayong problema, ha?`,
          }
        : {
            title: `${bill.provider} is due ${soon}`,
            body: `${amt} — take care of it now so there's nothing to worry about!`,
          };
    case "marites":
      return fil
        ? {
            title: `Uy, ${bill.provider}! 🤫`,
            body: `${amt} due ${soon}. Ang chismis ko sa'yo — bayaran mo na yan!`,
          }
        : {
            title: `Uy, ${bill.provider}! 🤫`,
            body: `${amt} due ${soon}. My tip for you — pay it now, don't let it slide!`,
          };
    default:
      return {
        title: `${bill.provider} is due ${soon}`,
        body: `${amt} — good time to clear it before ${bill.dueLabel}.`,
      };
  }
}

function nudgeCopy(persona: PersonaId, bill: Bill, language: string, cardName?: string): { title: string; body: string } {
  const amt = pesoStr(bill.amount);
  if (cardName) return cardLinkedNudgeCopy(persona, bill, amt, language, cardName);
  const fil = useFilipino(persona, language);
  switch (persona) {
    case "funny":
      return {
        title: `${bill.provider} is due TODAY 🎯`,
        body: `${amt}. Pay it now so you can forget about it guilt-free.`,
      };
    case "sib":
      return {
        title: `${bill.provider}. Today. Pay it.`,
        body: `${amt}. You knew this was coming.`,
      };
    case "mama":
      return fil
        ? {
            title: `Anak, ${bill.provider} is due today`,
            body: `${amt} lang naman. Huwag mo nang palawigin pa.`,
          }
        : {
            title: `${bill.provider} is due today`,
            body: `${amt} — pay it now, no delays!`,
          };
    case "marites":
      return fil
        ? {
            title: `Psst! ${bill.provider} is due today! 🫣`,
            body: `${amt} ngayon ha! Baka malate ka pa.`,
          }
        : {
            title: `Psst! ${bill.provider} is due today! 🫣`,
            body: `${amt} — don't be late on this one!`,
          };
    default:
      return {
        title: `${bill.provider} is due today`,
        body: `${amt} — clear it before it goes overdue.`,
      };
  }
}

// ─── Card-linked copy ─────────────────────────────────────────────────────────
// These bills are auto-charged to a credit card, so the wording shifts from
// "pay it" to "heads-up, it lands on {card}". The 💳 + card name is the clue.

function cardLinkedReminderCopy(
  persona: PersonaId,
  bill: Bill,
  soon: string,
  amt: string,
  language: string,
  cardName: string,
): { title: string; body: string } {
  const base = `${amt} will be auto-charged to your ${cardName} card ${soon}.`;
  const fil = useFilipino(persona, language);
  switch (persona) {
    case "funny":
      return { title: `💳 ${bill.provider} → ${cardName}`, body: `${base} Nothing to pay by hand — just keep ${cardName} happy 😉` };
    case "sib":
      return { title: `💳 ${bill.provider} hits ${cardName}`, body: `${base} You don't lift a finger — consider yourself informed.` };
    case "mama":
      return fil
        ? { title: `💳 ${bill.provider} (sa ${cardName})`, body: `${base} Auto na 'to sa card mo, anak — pang-alala lang.` }
        : { title: `💳 ${bill.provider} (${cardName})`, body: `${base} Auto-charged to your card — just a heads-up!` };
    case "marites":
      return fil
        ? { title: `💳 Psst — ${bill.provider}!`, body: `${base} Naka-charge 'to sa ${cardName} mo, ha — alam mo na!` }
        : { title: `💳 Psst — ${bill.provider}!`, body: `${base} Charged to your ${cardName} — just so you know!` };
    default:
      return { title: `💳 ${bill.provider} via ${cardName}`, body: `${base} Auto-charged to your card — just a heads-up.` };
  }
}

function cardLinkedNudgeCopy(
  persona: PersonaId,
  bill: Bill,
  amt: string,
  language: string,
  cardName: string,
): { title: string; body: string } {
  const base = `${amt} is charged to your ${cardName} card today.`;
  const fil = useFilipino(persona, language);
  switch (persona) {
    case "funny":
      return { title: `💳 ${bill.provider} charges today`, body: `${base} Auto-pay's got it — just looping you in.` };
    case "sib":
      return { title: `💳 ${bill.provider} → ${cardName}, today`, body: `${base} No action needed. As always.` };
    case "mama":
      return fil
        ? { title: `💳 ${bill.provider} ngayong araw`, body: `${base} Auto na sa card, anak — pang-alala lang.` }
        : { title: `💳 ${bill.provider} charges today`, body: `${base} Auto-charged to your card — just a heads-up!` };
    case "marites":
      return fil
        ? { title: `💳 ${bill.provider} today!`, body: `${base} Naka-charge na sa ${cardName} — chika lang!` }
        : { title: `💳 ${bill.provider} today!`, body: `${base} Charged to your ${cardName} — just so you know!` };
    default:
      return { title: `💳 ${bill.provider} via ${cardName}`, body: `${base} Auto-charged — just so you know.` };
  }
}

// ─── Identifiers ──────────────────────────────────────────────────────────────

const reminderId = (id: string) => `judith-reminder-${id}`;
const nudgeId    = (id: string) => `judith-nudge-${id}`;

// ─── Scheduling ───────────────────────────────────────────────────────────────

async function scheduleBill(
  bill: Bill,
  persona: PersonaId,
  language: string,
  opts: { reminder: boolean; nudge: boolean; leadDays: number; cardName?: string },
): Promise<void> {
  const now = new Date();

  // Stored dueDays/dueLabel are stale snapshots; recompute the next occurrence
  // live (rolls forward — you can't schedule a reminder in the past). A bill due
  // today stays today; an already-passed monthly bill rolls to next month.
  const occ = nextOccurrence(bill, now);
  const liveBill: Bill = { ...bill, dueDays: occ.dueDays, dueLabel: occ.dueLabel };

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + occ.dueDays);
  // Fire at the user's chosen local hour (0–23). setHours uses the device's
  // current timezone, so a "9" picked in Manila correctly fires at 9 AM
  // local in Manila — and also at 9 AM local after a user travels to Tokyo,
  // matching expectations for a personal reminder. Default 9 (9 AM).
  const hour = Math.max(0, Math.min(23, bill.reminderHour ?? 9));
  dueAt.setHours(hour, 0, 0, 0);

  const ops: Promise<string>[] = [];

  if (opts.reminder) {
    const fireAt = new Date(dueAt);
    fireAt.setDate(dueAt.getDate() - opts.leadDays);
    if (fireAt > now) {
      const copy = reminderCopy(persona, liveBill, opts.leadDays, language, opts.cardName);
      ops.push(
        Notifications.scheduleNotificationAsync({
          identifier: reminderId(bill.id),
          content: { title: copy.title, body: copy.body, sound: true, categoryIdentifier: "BILL_REMINDER", data: { billId: bill.id, type: "reminder" } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        }),
      );
    }
  }

  if (opts.nudge && dueAt > now) {
    const copy = nudgeCopy(persona, liveBill, language, opts.cardName);
    ops.push(
      Notifications.scheduleNotificationAsync({
        identifier: nudgeId(bill.id),
        content: { title: copy.title, body: copy.body, sound: true, categoryIdentifier: "BILL_REMINDER", data: { billId: bill.id, type: "nudge" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueAt },
      }),
    );
  }

  await Promise.allSettled(ops);
}

/** Cancels both the reminder and nudge for a single bill. */
export async function cancelBillNotifications(billId: string): Promise<void> {
  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(reminderId(billId)),
    Notifications.cancelScheduledNotificationAsync(nudgeId(billId)),
  ]);
}

/** Cancels every Judith-owned scheduled notification. */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.allSettled(
    all
      .filter((n) => n.identifier.startsWith("judith-"))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Full sync — cancel everything, then re-schedule for all unpaid bills.
 * Call this whenever bills, toggles, persona, or language change.
 * No-ops on web.
 */
export async function syncNotifications(
  bills: Bill[],
  persona: PersonaId,
  language: string,
  opts: { reminder: boolean; nudge: boolean },
): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelAllNotifications();
  if (!opts.reminder && !opts.nudge) return;

  // Don't pre-filter on the stale b.dueDays; scheduleBill recomputes the next
  // occurrence live and skips anything whose fire time is already in the past.
  const unpaid = bills.filter((b) => b.status !== "paid");
  await Promise.allSettled(
    unpaid.map((bill) => {
      // Card-linked bills still get notified, but with a clue naming the card
      // they're auto-charged to. Falls back to no clue if the card is gone.
      const cardName = isPaidViaCard(bill)
        ? bills.find((c) => c.id === bill.parentCardId)?.provider
        : undefined;
      return scheduleBill(bill, persona, language, { ...opts, leadDays: bill.reminderDays ?? 3, cardName });
    }),
  );
}

/**
 * Hard guard against the "push-token listener thrash" loop. Background:
 * `addPushTokenListener` (mounted in app/_layout.tsx) fires its callback
 * whenever expo-notifications has a new device push token. The callback
 * calls THIS function, which calls `getDevicePushTokenAsync`, which on
 * the iOS simulator (where tokens are unobtainable) fires the listener
 * AGAIN — creating an infinite loop. Each iteration logged a warning,
 * starved the JS thread, and saturated the IPC bridge. Symptom: "scroll
 * works, taps don't" — JS thread eaten by the warning flood.
 *
 * Fix: a module-level cooldown that drops any call within 2s of the last
 * one. Token rotations on real devices are minutes/hours apart, so a 2s
 * guard never blocks a legitimate sync; it only kills the runaway loop.
 */
let _lastSyncAt = 0;
const SYNC_COOLDOWN_MS = 2000;
/** Simulator detection — push tokens are never obtainable on iOS sim, so
 *  attempting the registration there guarantees the loop above. */
function isIOSSimulator(): boolean {
  if (Platform.OS !== "ios") return false;
  const model = (Constants.platform as { ios?: { model?: string } } | undefined)?.ios?.model;
  return typeof model === "string" && model.toLowerCase().includes("simulator");
}

export async function syncRemotePushRegistrationToSession(): Promise<void> {
  if (Platform.OS === "web" || !supabase) return;
  // Skip on iOS simulator — getDevicePushTokenAsync re-triggers the push
  // listener which re-enters this function. Real devices only.
  if (isIOSSimulator()) return;
  // Cooldown — at most one sync per 2s regardless of how often the push
  // token listener fires. Critical safety net even if the simulator
  // detection misses an edge case.
  const now = Date.now();
  if (now - _lastSyncAt < SYNC_COOLDOWN_MS) return;
  _lastSyncAt = now;

  const previous = await readStoredRemotePushRegistration();
  const registration = await registerRemotePushTokens();
  if (!registration) return;

  if (registrationsEqual(previous, registration)) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    await writeStoredRemotePushRegistration(registration);
    return;
  }

  const currentMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};

  const nextMetadata = {
    ...currentMetadata,
    judithPushNotifications: registration,
  };

  const { error } = await supabase.auth.updateUser({
    data: nextMetadata,
  });
  if (error) throw error;

  await writeStoredRemotePushRegistration(registration);
}
