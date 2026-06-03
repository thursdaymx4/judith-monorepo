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
import { Alert, Platform } from "react-native";
import type { Bill } from "@/constants/data";
import type { PersonaId } from "@/constants/personas";

// Show alerts even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
  if (current === "granted") return true;
  if (current === "denied") {
    Alert.alert(
      "Enable notifications",
      'Judith needs notification access to send bill reminders. Go to Settings → Judith → Notifications and turn them on.',
      [{ text: "Got it" }],
    );
    return false;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ─── Notification copy ────────────────────────────────────────────────────────

function pesoStr(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-US")}`;
}

function reminderCopy(
  persona: PersonaId,
  bill: Bill,
  leadDays: number,
): { title: string; body: string } {
  const amt = pesoStr(bill.amount);
  const soon = leadDays === 1 ? "tomorrow" : `in ${leadDays} days`;
  switch (persona) {
    case "funny":
      return {
        title: `Heads up — ${bill.provider} 👀`,
        body: `${amt} due ${soon}. Let's not gift them late fees, okay?`,
      };
    case "sarcastic":
      return {
        title: `${bill.provider} — you know what's coming.`,
        body: `${amt} due ${soon}. Pay it before I have to remind you twice.`,
      };
    case "mom":
      return {
        title: `${bill.provider} is due ${soon}`,
        body: `${amt} na lang. Bayaran mo na para wala tayong problema, ha?`,
      };
    case "marites":
      return {
        title: `Uy, ${bill.provider}! 🤫`,
        body: `${amt} due ${soon}. Ang chismis ko sa'yo — bayaran mo na yan!`,
      };
    default:
      return {
        title: `${bill.provider} is due ${soon}`,
        body: `${amt} — good time to clear it before ${bill.dueLabel}.`,
      };
  }
}

function nudgeCopy(persona: PersonaId, bill: Bill): { title: string; body: string } {
  const amt = pesoStr(bill.amount);
  switch (persona) {
    case "funny":
      return {
        title: `${bill.provider} is due TODAY 🎯`,
        body: `${amt}. Pay it now so you can forget about it guilt-free.`,
      };
    case "sarcastic":
      return {
        title: `${bill.provider}. Today. Pay it.`,
        body: `${amt}. You knew this was coming.`,
      };
    case "mom":
      return {
        title: `Anak, ${bill.provider} is due today`,
        body: `${amt} lang naman. Huwag mo nang palawigin pa.`,
      };
    case "marites":
      return {
        title: `Psst! ${bill.provider} is due today! 🫣`,
        body: `${amt} ngayon ha! Baka malate ka pa.`,
      };
    default:
      return {
        title: `${bill.provider} is due today`,
        body: `${amt} — clear it before it goes overdue.`,
      };
  }
}

// ─── Identifiers ──────────────────────────────────────────────────────────────

const reminderId = (id: string) => `judith-reminder-${id}`;
const nudgeId    = (id: string) => `judith-nudge-${id}`;

// ─── Scheduling ───────────────────────────────────────────────────────────────

async function scheduleBill(
  bill: Bill,
  persona: PersonaId,
  opts: { reminder: boolean; nudge: boolean; leadDays: number },
): Promise<void> {
  const now = new Date();

  // Compute the actual due date from today + dueDays (store's live value)
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + bill.dueDays);
  dueAt.setHours(9, 0, 0, 0);

  const ops: Promise<string>[] = [];

  if (opts.reminder) {
    const fireAt = new Date(dueAt);
    fireAt.setDate(dueAt.getDate() - opts.leadDays);
    if (fireAt > now) {
      const copy = reminderCopy(persona, bill, opts.leadDays);
      ops.push(
        Notifications.scheduleNotificationAsync({
          identifier: reminderId(bill.id),
          content: { title: copy.title, body: copy.body, sound: true, data: { billId: bill.id, type: "reminder" } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        }),
      );
    }
  }

  if (opts.nudge && dueAt > now) {
    const copy = nudgeCopy(persona, bill);
    ops.push(
      Notifications.scheduleNotificationAsync({
        identifier: nudgeId(bill.id),
        content: { title: copy.title, body: copy.body, sound: true, data: { billId: bill.id, type: "nudge" } },
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
 * Call this whenever bills, toggles, or persona change.
 * No-ops on web.
 */
export async function syncNotifications(
  bills: Bill[],
  persona: PersonaId,
  opts: { reminder: boolean; nudge: boolean },
): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelAllNotifications();
  if (!opts.reminder && !opts.nudge) return;

  const unpaid = bills.filter((b) => b.status !== "paid" && b.dueDays >= 0);
  await Promise.allSettled(
    unpaid.map((bill) =>
      scheduleBill(bill, persona, { ...opts, leadDays: 3 }),
    ),
  );
}
