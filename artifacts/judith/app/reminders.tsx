import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import {
  Low,
  Mono,
  Muted,
  ProviderLogo,
  Screen,
  SheetHeader,
  Txt,
  mix,
} from "@/components/ui";
import { MOM_ENDEARMENT } from "@/constants/countries";
import { dueClass, dueText, type Bill } from "@/constants/data";
import type { PersonaId } from "@/constants/personas";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { getPermissionStatus } from "@/lib/notifications";

/* persona + country flavored notification copy for a given bill */
function reminderCopy(
  persona: PersonaId,
  bill: Bill,
  money: (n: number) => string,
  code: string,
): { title: string; body: string } {
  const amt = money(bill.amount);
  const inDays = dueText(bill.dueDays);
  const term = MOM_ENDEARMENT[code] || "Anak";
  switch (persona) {
    case "funny":
      return {
        title: "Heads up — " + bill.provider + " 👀",
        body: amt + " " + inDays + ". Let’s not gift them late-fee money, okay?",
      };
    case "sib":
      return {
        title: bill.provider + " again.",
        body: amt + ", " + inDays + ". Pay it before I have to remind you twice.",
      };
    case "mama":
      return {
        title: term + ", " + bill.provider + " is " + inDays,
        body: amt + " na lang. Bayaran mo na para wala tayong problema, ha?",
      };
    default:
      return {
        title: bill.provider + " " + inDays,
        body: amt + " — a good time to clear it before it’s late.",
      };
  }
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function reminderDate(bill: Bill, leadDays: number): string {
  const today = new Date();
  const due = new Date(today);
  due.setDate(today.getDate() + bill.dueDays);
  const reminder = new Date(due);
  reminder.setDate(due.getDate() - (leadDays || 3));
  return `${MONTH_NAMES[reminder.getMonth()]} ${reminder.getDate()}`;
}

function LockNotification({ bill }: { bill: Bill | null }) {
  const t = useTheme();
  const { persona, country, money, markPaid, snooze } = useJudith();
  const copy = bill
    ? reminderCopy(persona, bill, money, country.code)
    : {
        title: "You’re all caught up",
        body: "Nothing due in the next few days. I’ll nudge you when something’s coming.",
      };
  return (
    <View
      style={{
        borderRadius: 22,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: t.hair,
      }}
    >
      <LinearGradient
        colors={[t.canvas, t.surface2] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.18, y: 1 }}
        style={{ padding: 16, paddingTop: 22, paddingBottom: 18 }}
      >
        {/* radial accent glow at top */}
        <LinearGradient
          colors={[mix(t.accent, t.canvas, 0.16), "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120 }}
          pointerEvents="none"
        />
        {/* lock time */}
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <Text
            style={{
              fontFamily: t.fonts.mono,
              color: t.txtHi,
              fontSize: 50,
              lineHeight: 50,
              letterSpacing: -1,
            }}
          >
            9:41
          </Text>
          <Text
            style={{
              fontFamily: t.fonts.regular,
              color: t.txtMid,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Monday, June 1
          </Text>
        </View>
        {/* notification */}
        <View
          style={{
            borderRadius: 17,
            padding: 12,
            paddingHorizontal: 13,
            backgroundColor: t.surface3,
            borderWidth: 1,
            borderColor: t.hair,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <JudithAvatar persona={persona} size={26} state="idle" />
            </View>
            <Text
              style={{
                fontFamily: t.fonts.bold,
                fontSize: 11,
                letterSpacing: 0.77,
                color: t.txtMid,
              }}
            >
              JUDITH
            </Text>
            <Text
              style={{
                marginLeft: "auto",
                fontFamily: t.fonts.regular,
                fontSize: 11,
                color: t.txtLow,
              }}
            >
              now
            </Text>
          </View>
          <Text
            style={{
              color: t.txtHi,
              fontFamily: t.fonts.semibold,
              fontSize: 15,
              lineHeight: 18.75,
            }}
          >
            {copy.title}
          </Text>
          <Text
            style={{
              color: t.txtMid,
              fontFamily: t.fonts.regular,
              fontSize: 13.5,
              lineHeight: 18.2,
              marginTop: 3,
            }}
          >
            {copy.body}
          </Text>
          {bill && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => markPaid(bill.id)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: 8,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: "transparent",
                    backgroundColor: t.accent,
                  },
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Icon name="wallet" size={15} color="#07080a" />
                <Text style={{ fontFamily: t.fonts.semibold, fontSize: 13, color: "#07080a" }}>
                  Pay now
                </Text>
              </Pressable>
              <Pressable
                onPress={() => snooze(bill.id, 1)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: 8,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: t.hair2,
                    backgroundColor: t.surface2,
                  },
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Icon name="snooze" size={15} color={t.txtMid} />
                <Text style={{ fontFamily: t.fonts.semibold, fontSize: 13, color: t.txtMid }}>
                  Remind tomorrow
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

export default function RemindersModal() {
  const t = useTheme();
  const router = useRouter();
  const { bills, money, toggles } = useJudith();
  const [permStatus, setPermStatus] = React.useState<"granted" | "denied" | "undetermined">("undetermined");

  React.useEffect(() => {
    getPermissionStatus().then(setPermStatus).catch(() => {});
  }, []);

  const list = bills
    .filter((b) => b.status !== "paid")
    .slice()
    .sort((a, b) => a.dueDays - b.dueDays);
  const hero = list[0] || null;
  const lead = 3; // days before — matches Settings default
  const remindersOn = toggles.dueReminders !== false;
  const notificationsBlocked = remindersOn && permStatus === "denied";

  /* group reminders by when Judith will nudge */
  const groups = [
    { label: "Sending soon", items: list.filter((b) => b.dueDays <= 3) },
    { label: "This week", items: list.filter((b) => b.dueDays > 3 && b.dueDays <= 7) },
    { label: "Later this month", items: list.filter((b) => b.dueDays > 7) },
  ].filter((g) => g.items.length);

  const openBill = (b: Bill) => router.push(`/bill/${b.id}`);

  return (
    <Screen contentStyle={{ paddingTop: 14, paddingBottom: 24 }}>
      <SheetHeader title="Reminders" onClose={() => router.back()} />
      <Muted size={14} style={{ marginTop: 4, marginBottom: 16 }}>
        Here’s how Judith will nudge you — and when.
      </Muted>

      <LockNotification bill={hero} />

      {/* Toggle is off → link to settings */}
      {!remindersOn && (
        <Pressable
          onPress={() => router.push("/settings")}
          style={{
            marginTop: 16,
            flexDirection: "row",
            gap: 11,
            alignItems: "center",
            borderWidth: 1,
            borderColor: mix(t.semantic.near, t.surface2, 0.4),
            borderRadius: t.radius.md,
            backgroundColor: t.surface2,
            padding: t.space.pad,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: t.hair,
              backgroundColor: t.surface3,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="bell" size={17} color={t.semantic.near} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="semibold">Reminders are off</Txt>
            <Low size={12}>Turn them on in Settings so these can send.</Low>
          </View>
          <Icon name="chev" size={16} color={t.txtMid} />
        </Pressable>
      )}

      {/* Toggle is on but OS permission denied → open device settings */}
      {notificationsBlocked && (
        <Pressable
          onPress={() => Linking.openSettings()}
          style={{
            marginTop: 16,
            flexDirection: "row",
            gap: 11,
            alignItems: "center",
            borderWidth: 1,
            borderColor: mix(t.semantic.warning ?? t.semantic.near, t.surface2, 0.4),
            borderRadius: t.radius.md,
            backgroundColor: t.surface2,
            padding: t.space.pad,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: t.hair,
              backgroundColor: t.surface3,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="bell" size={17} color={t.semantic.near} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="semibold">Notifications are blocked</Txt>
            <Low size={12}>Tap to enable them in your device Settings.</Low>
          </View>
          <Icon name="chev" size={16} color={t.txtMid} />
        </Pressable>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 20,
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            fontFamily: t.fonts.medium,
            fontSize: 13,
            color: t.txtMid,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Scheduled
        </Text>
        <Low size={12}>{lead} days before · 9:00 AM</Low>
      </View>

      {groups.map((g) => (
        <View key={g.label}>
          <Text
            style={{
              fontFamily: t.fonts.semibold,
              fontSize: 12,
              color: t.txtLow,
              marginTop: 12,
              marginBottom: 8,
            }}
          >
            {g.label}
          </Text>
          <View style={{ gap: 9, marginBottom: 6 }}>
            {g.items.map((b) => {
              const cls = dueClass(b.dueDays);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => openBill(b)}
                  style={({ pressed }) => [
                    {
                      position: "relative",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 11,
                      paddingLeft: 16,
                      paddingRight: 13,
                      borderRadius: t.radius.md,
                      backgroundColor: t.surface2,
                      borderWidth: 1,
                      borderColor: t.hair,
                      overflow: "hidden",
                    },
                    pressed && { transform: [{ scale: 0.995 }] },
                  ]}
                >
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      backgroundColor: t.semantic[cls],
                    }}
                  />
                  <ProviderLogo provider={b.provider} cat={b.cat} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt size={14} weight="medium">
                      {b.provider}
                    </Txt>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 2,
                      }}
                    >
                      <Icon name="bell" size={11} color={t.txtLow} />
                      <Low size={12}>
                        Reminder {reminderDate(b, lead)} · 9:00 AM
                      </Low>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Mono size={14} weight="semibold" color={t.semantic[cls]}>
                      {money(b.amount)}
                    </Mono>
                    <Low size={10}>due {b.dueLabel}</Low>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {list.length === 0 && (
        <View
          style={{
            alignItems: "center",
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: t.radius.md,
            backgroundColor: t.surface2,
            paddingVertical: 26,
            paddingHorizontal: 16,
          }}
        >
          <Txt size={14} weight="semibold">
            No reminders scheduled
          </Txt>
          <Low size={12} style={{ marginTop: 4 }}>
            You’re all caught up. Judith will set new ones as bills come due.
          </Low>
        </View>
      )}
    </Screen>
  );
}
