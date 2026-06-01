import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

interface FloatCat {
  icon: IconName;
  t: string;
  color: string;
  pos: { top?: number; bottom?: number; left?: number; right?: number };
  delay: number;
}

const CATS: FloatCat[] = [
  { icon: "zap",     t: "Electricity",  color: "#f28f29", pos: { top: 120,    left: 16 },  delay: 0    },
  { icon: "wifi",    t: "Internet",      color: "#a289f8", pos: { top: 172,    right: 14 }, delay: 600  },
  { icon: "droplet", t: "Water",         color: "#32b3e6", pos: { bottom: 248, left: 20 },  delay: 1200 },
  { icon: "spark",   t: "Subscriptions", color: "#df86d7", pos: { bottom: 200, right: 16 }, delay: 900  },
];

function mixAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function FloatPill({ cat, decoExit }: { cat: FloatCat; decoExit: Animated.Value }) {
  const t = useTheme();
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: -10,
          duration: 2500,
          delay: cat.delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y, cat.delay]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        ...cat.pos,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingVertical: 9,
        paddingLeft: 9,
        paddingRight: 14,
        borderRadius: 999,
        backgroundColor: mixAlpha(t.surface2, 0.82),
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        transform: [{ translateY: y }],
        opacity: decoExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mixAlpha(cat.color, 0.18),
          borderWidth: 1,
          borderColor: mixAlpha(cat.color, 0.4),
        }}
      >
        <Icon name={cat.icon} size={15} color={cat.color} />
      </View>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: t.txtHi,
          fontFamily: t.fonts.semibold,
        }}
      >
        {cat.t}
      </Text>
    </Animated.View>
  );
}

/** Bloom splash (FLOW_DEFAULTS splashStyle=bloom). Shown on cold start. */
export function Splash({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { persona } = useJudith();
  const insets = useSafeAreaInsets();

  // ── entry animations ──────────────────────────────────────────────────────
  const word  = useRef(new Animated.Value(0)).current;
  const tag   = useRef(new Animated.Value(0)).current;
  const foot  = useRef(new Animated.Value(0)).current;
  const bloom = useRef(new Animated.Value(0)).current;

  // ── exit animations ───────────────────────────────────────────────────────
  const exitOpacity = useRef(new Animated.Value(1)).current; // entire overlay
  const wordExitY   = useRef(new Animated.Value(0)).current; // wordmark slides up
  const decoExit    = useRef(new Animated.Value(0)).current; // pills/bloom (0=visible, 1=gone)
  const avatarScale = useRef(new Animated.Value(1)).current;

  const startExit = useCallback(() => {
    // wordmark slides up and fades (covered by overlay fade, but exits faster)
    Animated.timing(wordExitY, {
      toValue: -26,
      duration: 360,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
    // pills + bloom bg fade out
    Animated.timing(decoExit, {
      toValue: 1,
      duration: 420,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
    // avatar shrinks toward header position (matches prototype judToAuth scale)
    Animated.timing(avatarScale, {
      toValue: 0.7,
      duration: 540,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // full overlay cross-dissolve (slightly delayed so wordmark exits first)
    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 480,
      delay: 80,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();

    setTimeout(onDone, 600);
  }, [onDone, wordExitY, decoExit, avatarScale, exitOpacity]);

  useEffect(() => {
    // entry sequences
    Animated.timing(word,  { toValue: 1, duration: 1000, delay: 500,  useNativeDriver: true }).start();
    Animated.timing(tag,   { toValue: 1, duration: 900,  delay: 1050, useNativeDriver: true }).start();
    Animated.timing(foot,  { toValue: 1, duration: 800,  delay: 2800, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bloom, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bloom, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    const timer = setTimeout(startExit, 4600);
    return () => clearTimeout(timer);
  }, [word, tag, foot, bloom, startExit]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.canvas,
        zIndex: 100,
        opacity: exitOpacity,
      }}
    >
      <Pressable onPress={startExit} style={{ flex: 1 }}>
        {/* bloom background */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: decoExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
              { translateY: bloom.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
            ],
          }}
        >
          <LinearGradient
            colors={[mixAlpha(t.accent, 0.3), "transparent"]}
            start={{ x: 0.28, y: 0.32 }}
            end={{ x: 0.7, y: 0.7 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <LinearGradient
            colors={["transparent", mixAlpha("#df86d7", 0.26), "transparent"]}
            start={{ x: 0.9, y: 0.2 }}
            end={{ x: 0.3, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <LinearGradient
            colors={["transparent", mixAlpha("#f0c14d", 0.22)]}
            start={{ x: 0.5, y: 0.3 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </Animated.View>

        {/* floating category pills */}
        {CATS.map((c) => (
          <FloatPill key={c.t} cat={c} decoExit={decoExit} />
        ))}

        {/* avatar — scales down toward header as it exits (prototype judToAuth) */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 80,
          }}
        >
          <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
            <JudithAvatar persona={persona} size={132} state="listening" />
          </Animated.View>

          {/* "Judith" wordmark — Space Grotesk SemiBold, weight:600, matching prototype .splash-word */}
          <Animated.View
            style={{
              marginTop: 30,
              alignItems: "center",
              opacity: word,
              transform: [{ translateY: wordExitY }],
            }}
          >
            <Text
              style={{
                fontSize: 44,
                color: t.txtHi,
                fontFamily: t.fonts.semibold,
                letterSpacing: -0.88,
              }}
            >
              Judith
            </Text>
          </Animated.View>

          {/* tagline */}
          <Animated.View
            style={{ marginTop: 4, flexDirection: "row", opacity: tag }}
          >
            <Text
              style={{ fontSize: 15, color: t.txtMid, fontFamily: t.fonts.regular }}
            >
              Due Dates,{" "}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: t.accent,
                fontWeight: "800",
                fontFamily: t.fonts.bold,
              }}
            >
              Handled.
            </Text>
          </Animated.View>
        </View>

        <Animated.Text
          style={{
            position: "absolute",
            bottom: insets.bottom + 34,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 12,
            color: t.txtLow,
            letterSpacing: 0.5,
            fontFamily: t.fonts.regular,
            opacity: foot,
          }}
        >
          tap to continue
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}
