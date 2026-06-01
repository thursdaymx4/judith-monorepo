import { Link, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Txt } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";

export default function NotFoundScreen() {
  const t = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { backgroundColor: t.canvas }]}>
        <Txt size={20} weight="bold">
          This screen doesn&apos;t exist.
        </Txt>
        <Link href="/" style={styles.link}>
          <Txt size={14} color={t.accent}>
            Go to home screen!
          </Txt>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  link: { marginTop: 15, paddingVertical: 15 },
});
