import React from "react";
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { CAT_ICONS, dueClass, initials, isPartialBill, lookupProvider, partialPct, totalOwed } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/constants/theme";

/* ---------------- text ---------------- */

interface TxtProps extends TextProps {
  size?: number;
  weight?: "regular" | "medium" | "semibold" | "bold";
  color?: string;
  mono?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Txt({ size = 14, weight = "regular", color, mono, style, ...rest }: TxtProps) {
  const t = useTheme();
  const family = mono
    ? weight === "bold" || weight === "semibold"
      ? t.fonts.monoBold
      : t.fonts.mono
    : t.fonts[weight];
  return (
    <Text
      {...rest}
      style={[{ fontFamily: family, fontSize: size, color: color ?? t.txtHi }, style]}
    />
  );
}

/** Money / numeric text in JetBrains Mono. */
export function Mono({ size = 14, weight = "bold", color, style, ...rest }: TxtProps) {
  return <Txt mono size={size} weight={weight} color={color} style={style} {...rest} />;
}

export function Low(props: TxtProps) {
  const t = useTheme();
  return <Txt color={t.txtLow} {...props} />;
}

export function Muted(props: TxtProps) {
  const t = useTheme();
  return <Txt color={t.txtMid} {...props} />;
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: t.fonts.medium,
          fontSize: 13,
          color: t.txtMid,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginTop: 18,
          marginBottom: 10,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ---------------- containers ---------------- */

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    borderWidth: 1,
    borderColor: t.hair,
    borderRadius: t.radius.md,
    backgroundColor: t.surface2,
    padding: t.space.pad,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { transform: [{ scale: 0.99 }] }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

/** Page scroller matching `.pagepad` (8px 22px 28px). */
export function Screen({
  children,
  contentStyle,
  scroll = true,
  pad = true,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  pad?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const padStyle: ViewStyle = pad
    ? { paddingHorizontal: 22, paddingTop: insets.top + 12, paddingBottom: 96 }
    : {};
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: t.canvas }, padStyle, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.canvas }}
      contentContainerStyle={[padStyle, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/* ---------------- buttons ---------------- */

type BtnVariant = "primary" | "soft" | "ghost";

export function Btn({
  label,
  onPress,
  variant = "primary",
  icon,
  style,
  textStyle,
  children,
}: {
  label?: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const variants: Record<BtnVariant, ViewStyle> = {
    primary: { backgroundColor: t.accent },
    soft: { backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hair },
    ghost: { backgroundColor: "transparent" },
  };
  const txtColor = variant === "primary" ? t.onAccent : variant === "ghost" ? t.txtMid : t.txtHi;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: t.radius.md,
          paddingVertical: 15,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          width: "100%",
        },
        variants[variant],
        pressed && { transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={txtColor} />}
      {label != null && (
        <Text style={[{ fontFamily: t.fonts.bold, fontSize: 16, color: txtColor }, textStyle]}>{label}</Text>
      )}
      {children}
    </Pressable>
  );
}

export function RoundBtn({
  icon,
  onPress,
  size = 32,
  color,
}: {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: t.hair,
          backgroundColor: t.surface2,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed && { transform: [{ scale: 0.92 }] },
      ]}
    >
      <Icon name={icon} size={size * 0.5} color={color ?? t.txtMid} />
    </Pressable>
  );
}

export function Pill({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: 20,
          paddingVertical: 6,
          paddingHorizontal: 12,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderWidth: 1,
          borderColor: selected ? t.accent : t.hair,
          borderRadius: 22,
          paddingVertical: 9,
          paddingHorizontal: 14,
          backgroundColor: selected ? mix(t.accent, t.surface2, 0.16) : t.surface2,
        },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={13} color={selected ? t.txtHi : t.txtMid} />}
      <Text style={{ fontFamily: t.fonts.regular, fontSize: 13, color: selected ? t.txtHi : t.txtMid }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------------- bits ---------------- */

export type Urgency = "overdue" | "urgent" | "near" | "ok";

export function Dot({ kind, size = 8 }: { kind: Urgency; size?: number }) {
  const t = useTheme();
  const c = t.semantic[kind];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c,
        shadowColor: c,
        shadowOpacity: 0.9,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

/** Provider logo tile — brand color + short text, or category icon fallback. */
export function ProviderLogo({
  provider,
  cat,
  size = 38,
}: {
  provider?: string;
  cat?: string;
  size?: number;
}) {
  const t = useTheme();
  const prov = lookupProvider(provider);
  const radius = Math.round(size * 0.29);
  if (prov) {
    const short = prov.short || initials(prov.name);
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: prov.color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: t.fonts.bold, color: "#fff", fontSize: size * 0.34, letterSpacing: -0.3 }}>
          {short}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: t.surface3,
        borderWidth: 1,
        borderColor: t.hair,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={(cat && CAT_ICONS[cat]) || "spark"} size={size * 0.5} color={t.txtMid} />
    </View>
  );
}

export interface BillLike {
  id: string;
  provider: string;
  cat: string;
  amount: number;
  dueDays: number;
  dueLabel: string;
  status?: string;
  amountPaid?: number;
  carryOver?: number;
}

export function BillRow({
  bill,
  onPress,
  money,
}: {
  bill: BillLike;
  onPress?: () => void;
  money: (n: number) => string;
}) {
  const t = useTheme();
  const cls = dueClass(bill.dueDays) as Urgency;
  const paid = bill.status === "paid";
  const partial = isPartialBill(bill as Parameters<typeof isPartialBill>[0]);
  const pct = partialPct(bill as Parameters<typeof partialPct>[0]);
  const owed = totalOwed(bill);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: t.radius.md,
          backgroundColor: t.surface2,
          overflow: "hidden",
          opacity: paid ? 0.55 : 1,
        },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          paddingVertical: 13,
          paddingHorizontal: 14,
        }}
      >
        <ProviderLogo provider={bill.provider} cat={bill.cat} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: t.fonts.medium, fontSize: 15, color: t.txtHi }}>{bill.provider}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Dot kind={cls} />
            <Text style={{ fontFamily: t.fonts.regular, fontSize: 12, color: t.txtLow }}>
              {bill.cat} · {bill.dueLabel}
            </Text>
          </View>
        </View>
        <Mono size={15} color={paid ? t.semantic.ok : t.semantic[cls]}>
          {money(owed)}
        </Mono>
      </View>
      {(partial || paid) && (
        <View style={{ height: 4, backgroundColor: t.surface3, overflow: "hidden" }}>
          <View
            style={{
              height: "100%",
              width: `${pct}%`,
              backgroundColor: paid ? t.semantic.ok : t.semantic.near,
            }}
          />
        </View>
      )}
    </Pressable>
  );
}

export function SpeechBubble({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, position: "relative" }}>
      <View
        style={[
          {
            position: "absolute",
            left: -5,
            top: 16,
            width: 12,
            height: 12,
            backgroundColor: t.surface2,
            borderLeftWidth: 1,
            borderBottomWidth: 1,
            borderColor: t.hair,
            transform: [{ rotate: "45deg" }],
            borderBottomLeftRadius: 3,
          },
        ]}
      />
      <View
        style={[
          {
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 16,
            paddingVertical: 9,
            paddingHorizontal: 14,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function BellBtn({ count, onPress }: { count?: number; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          marginTop: 4,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.hair,
          backgroundColor: t.surface2,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed && { transform: [{ scale: 0.93 }] },
      ]}
    >
      <Icon name="bell" size={19} color={t.txtMid} />
      {count != null && count > 0 && (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: t.semantic.urgent,
            borderWidth: 2,
            borderColor: t.surface1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontFamily: t.fonts.bold, fontSize: 11 }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Paid-vs-due progress bar. */
export function PaidBar({ pct }: { pct: number }) {
  const t = useTheme();
  return (
    <View style={{ height: 12, borderRadius: 7, backgroundColor: t.surface3, overflow: "hidden" }}>
      <View
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          borderRadius: 7,
          backgroundColor: t.semantic.ok,
        }}
      />
    </View>
  );
}

/** Two-up stat card (e.g. due this month / next 7 days). */
export function StatDuo({
  left,
  right,
  money,
}: {
  left: { value: number; label: string };
  right: { value: number; label: string; color?: string };
  money: (n: number) => string;
}) {
  const t = useTheme();
  return (
    <Card style={{ flexDirection: "row", padding: 0, overflow: "hidden", marginBottom: 14 }}>
      <View style={{ flex: 1.3, paddingVertical: 14, paddingHorizontal: 15 }}>
        <Mono size={24} weight="bold">
          {money(left.value)}
        </Mono>
        <Low size={12} style={{ marginTop: 2 }}>
          {left.label}
        </Low>
      </View>
      <View style={{ width: 1, backgroundColor: t.hair }} />
      <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 15 }}>
        <Mono size={24} weight="bold" color={right.color ?? t.semantic.near}>
          {money(right.value)}
        </Mono>
        <Low size={12} style={{ marginTop: 2 }}>
          {right.label}
        </Low>
      </View>
    </Card>
  );
}

/** Sheet/modal header with grab handle, title, and close. */
export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          alignSelf: "center",
          width: 38,
          height: 5,
          borderRadius: 3,
          backgroundColor: t.hair,
          marginBottom: 4,
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: t.fonts.semibold, fontSize: 22, color: t.txtHi, letterSpacing: -0.4 }}>
          {title}
        </Text>
        <RoundBtn icon="x" size={32} onPress={onClose} />
      </View>
    </View>
  );
}

/** Global toast pinned above the tab bar. */
export function Toast() {
  const t = useTheme();
  const { toast } = useJudith();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 22,
        right: 22,
        bottom: 92 + insets.bottom,
        zIndex: 50,
        backgroundColor: t.surface3,
        borderWidth: 1,
        borderColor: t.hair,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 15,
        alignItems: "center",
      }}
    >
      <Text style={{ fontFamily: t.fonts.medium, fontSize: 14, color: t.txtHi }}>{toast}</Text>
    </View>
  );
}

/* ---------------- helpers ---------------- */

/** Approximate CSS color-mix(in oklab, fg p%, bg) by sRGB blend. */
export function mix(fg: string, bg: string, p: number): string {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return fg;
  const r = Math.round(a[0] * p + b[0] * (1 - p));
  const g = Math.round(a[1] * p + b[1] * (1 - p));
  const bl = Math.round(a[2] * p + b[2] * (1 - p));
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "");
  if (m.length === 6) {
    return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  }
  if (m.length === 3) {
    return [parseInt(m[0]! + m[0], 16), parseInt(m[1]! + m[1], 16), parseInt(m[2]! + m[2], 16)];
  }
  return null;
}

export type { Theme };
