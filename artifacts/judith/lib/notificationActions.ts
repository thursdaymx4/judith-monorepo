/**
 * notificationActions.ts — Phase 3 Sprint 2.
 *
 * Registers the iOS notification categories for the Auto-pay flow so users
 * can confirm or undo a match WITHOUT opening the app. The matching action
 * IDs flow through expo-notifications' response listener and end up in
 * handleAutoPayResponse() below, which calls back into the same
 * confirmSuggestion / undoAutoMark helpers the Activity log screen uses —
 * one source of truth for the state changes.
 *
 * Categories registered:
 *   SUGGEST_PAID    — fired when Judith sees a transaction matching a
 *                     bill at any confidence ≥ 0.6.
 *                     Buttons: "Mark Paid" | "Not this one"
 *   AUTO_MARK_UNDO  — fired when Judith auto-marked a bill paid
 *                     (high confidence + autoPayMark toggle on).
 *                     Buttons: "Undo"
 *
 * Privacy invariant: the data payload only contains the activity log
 * entry ID (a synthetic local string). No transaction IDs, merchant
 * names, or amounts cross the iOS notification payload — those stay in
 * the on-device Activity log keyed by the entry ID.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import {
  confirmSuggestion,
  loadActivity,
  undoAutoMark,
  type ActivityEntry,
} from "@/lib/financeMatching";

const CATEGORY_SUGGEST = "SUGGEST_PAID";
const CATEGORY_AUTO_UNDO = "AUTO_MARK_UNDO";

const ACTION_MARK_PAID = "AUTOPAY_MARK_PAID";
const ACTION_NOT_THIS = "AUTOPAY_NOT_THIS_ONE";
const ACTION_UNDO = "AUTOPAY_UNDO";

/**
 * Idempotent. Safe to call on every app launch. Categories registered with
 * the same identifier get replaced wholesale — no risk of double-stacked
 * action buttons.
 */
export async function registerAutoPayCategories(): Promise<void> {
  if (Platform.OS === "web") return;

  await Notifications.setNotificationCategoryAsync(CATEGORY_SUGGEST, [
    {
      identifier: ACTION_MARK_PAID,
      buttonTitle: "Mark Paid",
      // Foreground so the user lands in the Bill detail when they tap.
      // Background would leave them on the lock screen with no visible
      // confirmation of the state change.
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_NOT_THIS,
      buttonTitle: "Not this one",
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(CATEGORY_AUTO_UNDO, [
    {
      identifier: ACTION_UNDO,
      buttonTitle: "Undo",
      // Destructive flag turns the button red — matches iOS conventions for
      // reverting state.
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);
}

/**
 * Returns true when this is an Auto-pay notification we handled, so the
 * caller in _layout.tsx can skip its own bill-reminder routing.
 *
 * `markPaid` is wired to JudithStore.markPaid; we pass it through so this
 * module stays free of React/Context dependencies and can be called from
 * the cold-start path before providers mount.
 */
export async function handleAutoPayResponse(
  response: Notifications.NotificationResponse,
  markPaid: (billId: string) => void,
): Promise<boolean> {
  const category = response.notification.request.content.categoryIdentifier;
  if (category !== CATEGORY_SUGGEST && category !== CATEGORY_AUTO_UNDO) {
    return false;
  }

  const data = response.notification.request.content.data ?? {};
  const entryId = typeof data.entryId === "string" ? data.entryId : null;
  if (!entryId) return true; // Was ours but malformed — silently swallow.

  const action = response.actionIdentifier;

  switch (action) {
    case ACTION_MARK_PAID:
      await confirmSuggestion(entryId, markPaid);
      return true;

    case ACTION_NOT_THIS: {
      // Blacklist the underlying txn so future scans never re-suggest it,
      // but DON'T touch the bill state. Reuses undoAutoMark's blacklisting
      // path by passing a no-op unmark.
      const log = await loadActivity();
      const entry = log.find((e: ActivityEntry) => e.id === entryId);
      if (entry) {
        await undoAutoMark(entryId, () => {
          /* no-op: the bill was never marked paid in the first place */
        });
      }
      return true;
    }

    case ACTION_UNDO:
      await undoAutoMark(entryId, markPaid);
      return true;

    default:
      // Default tap (no action button) — the response listener in
      // _layout.tsx will push the user into the Activity screen.
      return false;
  }
}

export const AUTOPAY_CATEGORIES = {
  SUGGEST: CATEGORY_SUGGEST,
  AUTO_UNDO: CATEGORY_AUTO_UNDO,
} as const;
