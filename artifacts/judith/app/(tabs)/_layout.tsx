import { Tabs, usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Toast } from "@/components/ui";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "index", label: "Home", icon: "home" },
  { name: "calendar", label: "Calendar", icon: "cal" },
  { name: "insights", label: "Insights", icon: "chart" },
  { name: "settings", label: "Settings", icon: "gear" },
];

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

function TabBar({ state, navigation }: TabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.surface1,
        borderTopWidth: 1,
        borderTopColor: t.hair,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {state.routes.map((route, i) => {
        const meta = TABS.find((x) => x.name === route.name);
        if (!meta) return null;
        const focused = state.index === i;
        const color = focused ? t.accent : t.txtLow;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 4 }}
          >
            <Icon name={meta.icon} size={22} color={color} />
            <Text style={{ fontFamily: t.fonts.medium, fontSize: 11, color }}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AvatarFab() {
  const t = useTheme();
  const router = useRouter();
  const { persona } = useJudith();
  return (
    <Pressable
      onPress={() => router.push("/ask")}
      style={({ pressed }) => [
        {
          position: "absolute",
          right: 16,
          bottom: 80,
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.surface1,
          borderWidth: 1,
          borderColor: t.hair,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}
    >
      <JudithAvatar persona={persona} size={50} badge />
    </Pressable>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const pathname = usePathname();
  const showFab = !pathname.endsWith("/settings");

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.canvas } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="insights" />
        <Tabs.Screen name="settings" />
      </Tabs>
      {showFab && <AvatarFab />}
      <Toast />
    </View>
  );
}
