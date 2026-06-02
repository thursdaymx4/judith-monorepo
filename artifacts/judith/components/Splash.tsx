import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlowBlob, IntroScreenGlow } from "@/components/GlowBlob";
import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Bloom background ────────────────────────────────────────────────────────
// Three blobs matching prototype .bloom-bg exactly:
//   radial-gradient(40% 30% at 28% 32%, accent 30%, transparent 70%)
//   radial-gradient(45% 32% at 74% 60%, purple 28%, transparent 70%)
//   radial-gradient(40% 30% at 52% 78%, amber  26%, transparent 70%)
// On web, GlowBlob resolves to GlowBlob.web.tsx which renders a real CSS
// radial-gradient div — identical to the prototype. The container Animated.View
// gets filter:blur(6px), matching .bloom-bg exactly.
// On native, GlowBlob.tsx renders a low-opacity solid ellipse approximation.
const BLOOM_WEB_STYLE = Platform.OS === "web"
  ? ({ filter: "blur(6px)" } as object)
  : {};

function BloomBg({ decoExit }: { decoExit: Animated.Value }) {
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          opacity: decoExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        },
        BLOOM_WEB_STYLE,
      ]}
    >
      {/* blob 1 — teal/accent: large centered bloom behind avatar */}
      <GlowBlob cx={0.50} cy={0.38} rw={0.58} rh={0.48} color="rgba(41,213,165,0.60)" blur={90} />
      {/* blob 2 — purple/violet: bottom-right */}
      <GlowBlob cx={0.74} cy={0.64} rw={0.50} rh={0.36} color="rgba(160,120,255,0.55)" blur={85} />
      {/* blob 3 — amber/orange: bottom-left */}
      <GlowBlob cx={0.26} cy={0.76} rw={0.42} rh={0.32} color="rgba(247,150,50,0.50)" blur={80} />
    </Animated.View>
  );
}

// ─── Floating pill ────────────────────────────────────────────────────────────
// Prototype .float-pill positions: fc1-fc4 (top/bottom, left/right).
interface FloatCat {
  icon: IconName;
  label: string;
  color: string;
  pos: { top?: number; bottom?: number; left?: number; right?: number };
  floatDelay: number;
}
const FLOAT_CATS: FloatCat[] = [
  { icon: "zap",     label: "Electricity",  color: "#f28f29",
    pos: { top: 120,    left: 16 },   floatDelay: 0    },
  { icon: "wifi",    label: "Internet",      color: "#a289f8",
    pos: { top: 172,    right: 14 },  floatDelay: 900  },
  { icon: "droplet", label: "Water",         color: "#32b3e6",
    pos: { bottom: 248, left: 20 },   floatDelay: 600  },
  { icon: "spark",   label: "Subscriptions", color: "#df86d7",
    pos: { bottom: 200, right: 16 },  floatDelay: 1400 },
];

function FloatPill({
  cat,
  decoOpacity,
}: {
  cat: FloatCat;
  decoOpacity: Animated.AnimatedInterpolation<number>;
}) {
  const t = useTheme();
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: -10,
          duration: 2500,
          delay: cat.floatDelay,
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
  }, [y, cat.floatDelay]);

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
        backgroundColor: hexAlpha(t.surface2, 0.82),
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 18,
        shadowOpacity: 0.7,
        elevation: 8,
        opacity: decoOpacity,
        transform: [{ translateY: y }],
      }}
    >
      {/* icon badge */}
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hexAlpha(cat.color, 0.18),
          borderWidth: 1,
          borderColor: hexAlpha(cat.color, 0.40),
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
        {cat.label}
      </Text>
    </Animated.View>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────
/**
 * Bloom splash screen — matches prototype IntroShell stage-splash.
 * Background layers (bottom to top):
 *   1. canvas #0a0b0e
 *   2. intro-screen base glow: large teal radial at 50% 38% (accent 22%)
 *   3. bloom-bg three blobs with filter:blur(6px)  ← fade on exit
 *   4. float pills                                  ← fade on exit
 *   5. avatar (scales 1→0.7 on exit, judToAuth)
 *   6. "Judith" wordmark + "Due Dates, Handled." tagline
 *   7. "tap to continue" footer
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { persona } = useJudith();
  const insets = useSafeAreaInsets();

  // ── entry Animated values ─────────────────────────────────────────────────
  const word    = useRef(new Animated.Value(0)).current; // wordmark opacity
  const tag     = useRef(new Animated.Value(0)).current; // "Due Dates," opacity
  const foot    = useRef(new Animated.Value(0)).current; // footer opacity
  // "Handled." spring punch-in — handledIn 1s cubic(.18,1.5,.4,1) delay 1.9s
  const handled = useRef(new Animated.Value(0)).current;

  // ── exit Animated values ──────────────────────────────────────────────────
  const exitOpacity = useRef(new Animated.Value(1)).current; // whole overlay
  const wordExitY   = useRef(new Animated.Value(0)).current; // wordOut: slide -26px
  const decoExit    = useRef(new Animated.Value(0)).current; // deco fade (0=visible,1=gone)
  const avatarScale = useRef(new Animated.Value(1)).current; // judToAuth: 1→0.7

  const startExit = useCallback(() => {
    // wordOut: translateY -26px + fade — 420ms
    Animated.parallel([
      Animated.timing(wordExitY, {
        toValue: -26,
        duration: 360,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();

    // deco + pills fade out — 420ms
    Animated.timing(decoExit, {
      toValue: 1,
      duration: 420,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();

    // judToAuth: avatar scale 1→0.7 — 540ms
    Animated.timing(avatarScale, {
      toValue: 0.7,
      duration: 540,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // full overlay cross-dissolve — 480ms at 80ms delay
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
    // splashWord: opacity+translateY  delay 0.5s / 1.05s
    Animated.timing(word, { toValue: 1, duration: 1000, delay: 500,  easing: Easing.ease, useNativeDriver: true }).start();
    Animated.timing(tag,  { toValue: 1, duration: 900,  delay: 1050, easing: Easing.ease, useNativeDriver: true }).start();
    // footer: delay 2.8s
    Animated.timing(foot, { toValue: 1, duration: 800,  delay: 2800, easing: Easing.ease, useNativeDriver: true }).start();

    // handledIn: spring punch-in at 1.9s
    Animated.sequence([
      Animated.delay(1900),
      Animated.spring(handled, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // auto-advance after 4.6s
    const t2 = setTimeout(startExit, 4600);
    return () => clearTimeout(t2);
  }, [word, tag, foot, handled, startExit]);

  // "Handled." interpolated style — scale: 2.6→0.9→1.08→1 (mirrors handledIn keyframes)
  const handledOpacity = handled.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 1, 1],
  });
  const handledScale = handled.interpolate({
    inputRange: [0, 0.50, 0.70, 0.85, 1],
    outputRange: [2.6, 1.2,  0.9,  1.08, 1.0],
    extrapolate: "clamp",
  });

  // decoExit drives all deco opacity (bloom blobs handled inside BloomBg)
  const decoOpacity = decoExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: t.canvas,
        zIndex: 100,
        opacity: exitOpacity,
      }}
    >
      {/* 1. Intro-screen base glow — persists through exit cross-dissolve.
           radial-gradient(95% 55% at 50% 38%, accent 22%, transparent 62%) */}
      <IntroScreenGlow />

      {/* 2. Three bloom blobs (filter:blur 6px) — fade with deco */}
      <BloomBg decoExit={decoExit} />

      {/* 3. Floating category pills — fade with deco */}
      {FLOAT_CATS.map((c) => (
        <FloatPill key={c.label} cat={c} decoOpacity={decoOpacity} />
      ))}

      {/* 4. Tap anywhere to skip */}
      <Pressable
        onPress={startExit}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* 5. Avatar + wordmark (centred, above tap area via pointerEvents) */}
      <View
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 80,
          pointerEvents: "none",
        }}
      >
        {/* Avatar — judToAuth: scale 1→0.7 on exit */}
        <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
          <JudithAvatar persona={persona} size={132} state="listening" />
        </Animated.View>

        {/* "Judith" wordmark — splashWord + wordOut */}
        <Animated.View
          style={{
            marginTop: 30,
            alignItems: "center",
            opacity: word,
            transform: [
              {
                translateY: word.interpolate({
                  inputRange: [0, 1],
                  outputRange: [9, 0],
                }),
              },
              { translateY: wordExitY },
            ],
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

        {/* tagline — "Due Dates, " fades 1.05s; "Handled." punches 1.9s */}
        <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center" }}>
          <Animated.Text
            style={{
              fontSize: 15,
              color: t.txtMid,
              fontFamily: t.fonts.regular,
              opacity: tag,
            }}
          >
            {"Due Dates,\u00a0"}
          </Animated.Text>
          <Animated.View
            style={{
              opacity: handledOpacity,
              transform: [{ scale: handledScale }],
            }}
          >
            <Text
              style={{
                fontSize: 15,
                color: t.accent,
                fontFamily: t.fonts.display,
              }}
            >
              Handled.
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* 6. "tap to continue" footer */}
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
          pointerEvents: "none",
        }}
      >
        tap to continue
      </Animated.Text>
    </Animated.View>
  );
}
