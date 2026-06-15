/**
 * Wraps a bill row with leading + trailing swipe actions.
 *
 * Leading swipe (mint): Mark Paid → flips bill to paid, which triggers the
 *   celebratory cover via JudithStore.togglePaid.
 * Trailing swipes (RTL order: Edit, Snooze, Delete): open the edit form,
 *   push due date by 1 day (reschedules the reminder automatically because
 *   notifications scheduler reads dueDays via nextOccurrence), or confirm
 *   delete.
 *
 * Spec rules: no "Skip this month" action. Snooze means RESCHEDULE the
 * reminder (1-day shift), not visibility-hide.
 *
 * Disabled for via-card charges + already-paid bills because:
 *   - via-card "mark paid" is meaningless (the parent card carries the real
 *     payment); offering it would record a misleading payment record
 *   - paid bills shouldn't show a mark-paid swipe
 */
import React, { useRef } from "react";
import { Alert, Pressable, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { Icon } from "@/components/Icon";
import { Txt } from "@/components/ui";
import type { Bill } from "@/constants/data";
import { isPaidViaCard } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/lib/haptics";
import { useRouter } from "expo-router";

interface Props {
  bill: Bill;
  /** Stops the swipe from firing for already-paid rows on Home where the
   *  intent doesn't fit (paid → would need un-paid, but that's confusing as
   *  a swipe). Caller can override (e.g. on Bill Detail). */
  enableMarkPaid?: boolean;
  children: React.ReactNode;
}

export function BillRowSwipe({ bill, enableMarkPaid, children }: Props) {
  const t = useTheme();
  const router = useRouter();
  const { togglePaid, deleteBill, snooze, showToast } = useJudith();
  const swipeRef = useRef<SwipeableMethods | null>(null);
  // Always close the row after any action so the swipe state never lingers
  // (without this, a full-swipe leaves the row visually stuck in its open
  // position and blocks every subsequent tap + scroll on that row).
  const closeRow = () => swipeRef.current?.close();

  const viaCard = isPaidViaCard(bill);
  const isPaid = bill.status === "paid";
  const allowMarkPaid = (enableMarkPaid ?? true) && !viaCard && !isPaid;

  const onMarkPaid = () => {
    haptics.success();
    togglePaid(bill.id);
    closeRow();
  };
  const onEdit = () => {
    haptics.selection();
    closeRow();
    router.push(`/add-bill?id=${bill.id}`);
  };
  const onSnooze = () => {
    haptics.light();
    snooze(bill.id, 1);
    showToast(`Snoozed ${bill.provider} 1 day`);
    closeRow();
  };
  const onDelete = () => {
    haptics.error();
    Alert.alert(
      "Delete this bill?",
      `${bill.provider} will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => closeRow() },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteBill(bill.id);
            haptics.success();
            showToast(`Deleted ${bill.provider}`);
            closeRow();
          },
        },
      ],
    );
  };

  const renderLeft = (_progress: SharedValue<number>, drag: SharedValue<number>) => {
    const aStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: drag.value - 88 }],
    }));
    return (
      <Animated.View
        style={[
          {
            width: 88,
            borderRadius: t.radius.md,
            marginRight: 6,
          },
          aStyle,
        ]}
      >
        <Pressable
          onPress={onMarkPaid}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent,
            borderRadius: t.radius.md,
          }}
        >
          <ActionLabel icon="check" label="Paid" tint={t.onAccent} />
        </Pressable>
      </Animated.View>
    );
  };

  const renderRight = (_progress: SharedValue<number>, drag: SharedValue<number>) => {
    const aStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: drag.value + 240 }],
    }));
    return (
      <Animated.View style={[{ width: 240, flexDirection: "row", marginLeft: 6 }, aStyle]}>
        <Pressable
          onPress={onEdit}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.surface3, marginRight: 4, borderRadius: t.radius.md }}
        >
          <ActionLabel icon="pencil" label="Edit" tint={t.txtHi} />
        </Pressable>
        <Pressable
          onPress={onSnooze}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.semantic.near, marginRight: 4, borderRadius: t.radius.md }}
        >
          <ActionLabel icon="clock" label="Snooze" tint={t.onAccent} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.semantic.overdue, borderRadius: t.radius.md }}
        >
          <ActionLabel icon="x" label="Delete" tint="#fff" />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={88}
      rightThreshold={80}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={allowMarkPaid ? renderLeft : undefined}
      renderRightActions={renderRight}
      onSwipeableOpen={(dir) => {
        // Full-swipe left = fire mark-paid and immediately close the row so
        // the gesture state doesn't leave it stuck in its open position
        // (which silently blocks every tap + scroll on the row).
        if (dir === "left" && allowMarkPaid) onMarkPaid();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function ActionLabel({ icon, label, tint }: { icon: "check" | "pencil" | "clock" | "x"; label: string; tint: string }) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Icon name={icon as never} size={18} color={tint} />
      <Txt size={11} weight="semibold" color={tint}>{label}</Txt>
    </View>
  );
}
