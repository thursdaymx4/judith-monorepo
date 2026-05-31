import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, View, useColorScheme } from "react-native";

import { Paywall } from "@/components/Paywall";
import { PAYWALL_ENABLED } from "@/constants/config";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";

type FeatherName = keyof typeof Feather.glyphMap;
type SFName = React.ComponentProps<typeof SymbolView>["name"];

const TABS: {
  name: string;
  title: string;
  feather: FeatherName;
  sf: { default: SFName; selected: SFName };
}[] = [
  { name: "index", title: "Home", feather: "home", sf: { default: "house", selected: "house.fill" } },
  { name: "bills", title: "Bills", feather: "file-text", sf: { default: "doc.text", selected: "doc.text.fill" } },
  { name: "ask", title: "Ask", feather: "mic", sf: { default: "mic", selected: "mic.fill" } },
  { name: "settings", title: "Settings", feather: "settings", sf: { default: "gearshape", selected: "gearshape.fill" } },
];

function NativeTabLayout() {
  return (
    <NativeTabs>
      {TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.name}>
          <Icon sf={{ default: t.sf.default, selected: t.sf.selected }} />
          <Label>{t.title}</Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name={t.sf.default} tintColor={color} size={24} />
              ) : (
                <Feather name={t.feather} size={22} color={color} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { hasAccess, loading } = useSettings();

  if (PAYWALL_ENABLED && !hasAccess) {
    if (loading) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      );
    }
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Paywall />
      </View>
    );
  }

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  center: { flex: 1 },
});
