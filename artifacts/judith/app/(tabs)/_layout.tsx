import { type Href, Tabs, usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
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

const FAB_ACTIONS: { label: string; icon: IconName; to: Href }[] = [
  { label: "Scan a bill", icon: "scan", to: "/ask?intent=scan" },
  { label: "Use your voice", icon: "mic", to: "/ask?intent=voice" },
  { label: "Enter manually", icon: "keyboard", to: "/add-bill" },
  { label: "Ask Judith", icon: "spark", to: "/ask" },
];

function AvatarFab() {
  const t = useTheme();
  const router = useRouter();
  const { persona } = useJudith();
  const [open, setOpen] = useState(false);

  const go = (to: Href) => {
    setOpen(false);
    router.push(to);
  };

  const fabBase = {
    position: "absolute" as const,
    right: 16,
    bottom: 80,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: t.surface1,
    borderWidth: 1,
    borderColor: t.hair,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [fabBase, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <JudithAvatar persona={persona} size={50} badge />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          {/* action stack — sits just above the FAB */}
          <View style={{ position: "absolute", right: 20, bottom: 152, alignItems: "flex-end", gap: 12 }}>
            {FAB_ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => go(a.to)}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", gap: 11 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View
                  style={{
                    backgroundColor: t.surface1,
                    borderWidth: 1,
                    borderColor: t.hair,
                    borderRadius: 12,
                    paddingVertical: 9,
                    paddingHorizontal: 13,
                    shadowColor: "#000",
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 5 },
                  }}
                >
                  <Text style={{ fontFamily: t.fonts.semibold, fontSize: 14, color: t.txtHi }}>{a.label}</Text>
                </View>
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: t.surface1,
                    borderWidth: 1,
                    borderColor: t.hair,
                    shadowColor: "#000",
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 5 },
                  }}
                >
                  <Icon name={a.icon} size={21} color={t.accent} />
                </View>
              </Pressable>
            ))}
          </View>

          {/* close button in the FAB's place */}
          <View style={fabBase}>
            <Icon name="x" size={23} color={t.txtMid} />
          </View>
        </Pressable>
      </Modal>
    </>
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
