import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { computeNextDue, type Bill } from "./bills";
import { pesoDisplay } from "./tagalog";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Reschedules all reminders from scratch for the supplied bills. Each unpaid
 * bill is scheduled at every reminder offset (days before the due date) at 9am.
 */
export async function syncReminders(
  bills: Bill[],
  enabled: boolean,
): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const now = new Date();

  for (const bill of bills) {
    if (bill.status === "paid") continue;
    const due = computeNextDue(bill, now);
    if (!due) continue;

    // Don't fire reminders during an active snooze window.
    let floor = now;
    if (bill.status === "snoozed" && bill.snoozed_until) {
      const until = new Date(`${bill.snoozed_until}T00:00:00`);
      if (until > floor) floor = until;
    }

    for (const offset of bill.reminder_offsets ?? []) {
      const fireAt = new Date(due);
      fireAt.setDate(fireAt.getDate() - offset);
      fireAt.setHours(9, 0, 0, 0);
      if (fireAt <= floor) continue;

      const amount = bill.amount != null ? ` (${pesoDisplay(bill.amount)})` : "";
      const body =
        offset === 0
          ? `Due na ngayon ang ${bill.name}${amount}.`
          : `${offset} araw na lang bago ang due ng ${bill.name}${amount}.`;

      await Notifications.scheduleNotificationAsync({
        content: { title: "Judith reminder", body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      });
    }
  }
}
