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
import { isPaidViaCard, nextOccurrence, type Bill } from "@/constants/data";
import type { PersonaId } from "@/constants/personas";

// ─── Notification categories ──────────────────────────────────────────────────
// Register once on app start so iOS/Android know about the action buttons.
// "Mark Paid" opens the app; "Remind Tomorrow" can resolve silently.

export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.setNotificationCategoriesAsync([
    {
      identifier: "BILL_REMINDER",
      actions: [
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
      ],
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
  cardName?: string,
): { title: string; body: string } {
  const amt = pesoStr(bill.amount);
  const soon = leadDays === 1 ? "tomorrow" : `in ${leadDays} days`;
  // Card-linked bills are auto-charged, not paid by hand — give a heads-up with
  // a clear clue about which card it lands on.
  if (cardName) return cardLinkedReminderCopy(persona, bill, soon, amt, cardName);
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

function nudgeCopy(persona: PersonaId, bill: Bill, cardName?: string): { title: string; body: string } {
  const amt = pesoStr(bill.amount);
  if (cardName) return cardLinkedNudgeCopy(persona, bill, amt, cardName);
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

// ─── Card-linked copy ─────────────────────────────────────────────────────────
// These bills are auto-charged to a credit card, so the wording shifts from
// "pay it" to "heads-up, it lands on {card}". The 💳 + card name is the clue.

function cardLinkedReminderCopy(
  persona: PersonaId,
  bill: Bill,
  soon: string,
  amt: string,
  cardName: string,
): { title: string; body: string } {
  const base = `${amt} will be auto-charged to your ${cardName} card ${soon}.`;
  switch (persona) {
    case "funny":
      return { title: `💳 ${bill.provider} → ${cardName}`, body: `${base} Nothing to pay by hand — just keep ${cardName} happy 😉` };
    case "sib":
      return { title: `💳 ${bill.provider} hits ${cardName}`, body: `${base} You don't lift a finger — consider yourself informed.` };
    case "mama":
      return { title: `💳 ${bill.provider} (sa ${cardName})`, body: `${base} Auto na 'to sa card mo, anak — pang-alala lang.` };
    case "marites":
      return { title: `💳 Psst — ${bill.provider}!`, body: `${base} Naka-charge 'to sa ${cardName} mo, ha — alam mo na!` };
    default:
      return { title: `💳 ${bill.provider} via ${cardName}`, body: `${base} Auto-charged to your card — just a heads-up.` };
  }
}

function cardLinkedNudgeCopy(
  persona: PersonaId,
  bill: Bill,
  amt: string,
  cardName: string,
): { title: string; body: string } {
  const base = `${amt} is charged to your ${cardName} card today.`;
  switch (persona) {
    case "funny":
      return { title: `💳 ${bill.provider} charges today`, body: `${base} Auto-pay's got it — just looping you in.` };
    case "sib":
      return { title: `💳 ${bill.provider} → ${cardName}, today`, body: `${base} No action needed. As always.` };
    case "mama":
      return { title: `💳 ${bill.provider} ngayong araw`, body: `${base} Auto na sa card, anak — pang-alala lang.` };
    case "marites":
      return { title: `💳 ${bill.provider} today!`, body: `${base} Naka-charge na sa ${cardName} — chika lang!` };
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
  dueAt.setHours(9, 0, 0, 0);

  const ops: Promise<string>[] = [];

  if (opts.reminder) {
    const fireAt = new Date(dueAt);
    fireAt.setDate(dueAt.getDate() - opts.leadDays);
    if (fireAt > now) {
      const copy = reminderCopy(persona, liveBill, opts.leadDays, opts.cardName);
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
    const copy = nudgeCopy(persona, liveBill, opts.cardName);
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
      return scheduleBill(bill, persona, { ...opts, leadDays: bill.reminderDays ?? 3, cardName });
    }),
  );
}
