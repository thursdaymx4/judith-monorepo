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
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { haptics } from "@/lib/haptics";
import type { Theme } from "@/constants/theme";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Sonar ring dimensions ────────────────────────────────────────────────────
// Rings implemented inline in Splash component for unified loop management.
// Avatar = 132px → ring = 148px → offset top/left = -8px to center ring on avatar.
const RING_SIZE = 148;

// ─── Bloom background ────────────────────────────────────────────────────────
// Three blobs with independent breathing oscillation.
const BLOOM_WEB_STYLE = Platform.OS === "web"
  ? ({ filter: "blur(6px)" } as object)
  : {};

const BLOB_DELAYS = [0, 1333, 2667] as const;
const BLOB_CONFIGS = [
  { cx: 0.28, cy: 0.32, rw: 0.40, rh: 0.30, color: "rgba(41,213,165,0.30)" },
  { cx: 0.74, cy: 0.60, rw: 0.45, rh: 0.32, color: "rgba(244,166,205,0.28)" },
  { cx: 0.52, cy: 0.78, rw: 0.40, rh: 0.30, color: "rgba(247,206,130,0.26)" },
] as const;

function BloomBg({
  decoExit,
  reduce,
}: {
  decoExit: Animated.Value;
  reduce: boolean;
}) {
  // Independent scale value per blob for staggered oscillation
  const scale0 = useRef(new Animated.Value(1)).current;
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const blobScales = [scale0, scale1, scale2] as const;

  useEffect(() => {
    if (reduce) return;
    const loops = blobScales.map((sv, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(BLOB_DELAYS[i]!),
          Animated.timing(sv, {
            toValue: 1.07,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(sv, {
            toValue: 1.0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

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
      {BLOB_CONFIGS.map((cfg, i) => (
        // Each blob wrapped in a full-screen absolute View so the scale transform
        // applies around the screen center (close enough to each blob center at
        // the ±7% range used here — visually imperceptible shift).
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            transform: [{ scale: blobScales[i]! }],
          }}
        >
          <GlowBlob {...cfg} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// ─── Floating pill ────────────────────────────────────────────────────────────
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
 *   3. bloom-bg three blobs with filter:blur(6px)  ← fade on exit + breathe oscillation
 *   4. float pills                                  ← fade on exit
 *   5. avatar with sonar-ping rings behind it
 *   6. "Judith" wordmark + "Due Dates, Handled." tagline
 *   7. "tap to continue" footer
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { persona } = useJudith();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  // ── entry Animated values ─────────────────────────────────────────────────
  const word    = useRef(new Animated.Value(0)).current;
  const tag     = useRef(new Animated.Value(0)).current;
  const foot    = useRef(new Animated.Value(0)).current;
  const handled = useRef(new Animated.Value(0)).current;

  // ── exit Animated values ──────────────────────────────────────────────────
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const wordExitY   = useRef(new Animated.Value(0)).current;
  const decoExit    = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;

  // ── sonar ring values (two rings, staggered) ──────────────────────────────
  const ring1Scale   = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale   = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;

  const startExit = useCallback(() => {
    Animated.parallel([
      Animated.timing(wordExitY, {
        toValue: -26,
        duration: 360,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(decoExit, {
      toValue: 1,
      duration: 420,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();

    Animated.timing(avatarScale, {
      toValue: 0.7,
      duration: 540,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

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
    Animated.timing(word, { toValue: 1, duration: 1000, delay: 500,  easing: Easing.ease, useNativeDriver: true }).start();
    Animated.timing(tag,  { toValue: 1, duration: 900,  delay: 1050, easing: Easing.ease, useNativeDriver: true }).start();
    Animated.timing(foot, { toValue: 1, duration: 800,  delay: 2800, easing: Easing.ease, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(1900),
      Animated.spring(handled, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const t1 = setTimeout(() => haptics.heavy(), 1900);
    const t2 = setTimeout(startExit, 4600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [word, tag, foot, handled, startExit]);

  // ── sonar ring loops ──────────────────────────────────────────────────────
  useEffect(() => {
    if (reduce) return;

    const makeLoop = (
      sv: Animated.Value,
      ov: Animated.Value,
      delay: number,
    ) => {
      sv.setValue(1);
      ov.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(sv, {
              toValue: 1.78,
              duration: 2600,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(ov, { toValue: 0.4, duration: 160, useNativeDriver: true }),
              Animated.timing(ov, { toValue: 0, duration: 2440, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            ]),
          ]),
          Animated.timing(sv, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      );
    };

    const l1 = makeLoop(ring1Scale, ring1Opacity, 400);
    const l2 = makeLoop(ring2Scale, ring2Opacity, 1800);
    l1.start();
    l2.start();
    return () => { l1.stop(); l2.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  // ── derived styles ────────────────────────────────────────────────────────
  const handledOpacity = handled.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 1, 1],
  });
  const handledScale = handled.interpolate({
    inputRange: [0, 0.50, 0.70, 0.85, 1],
    outputRange: [2.6, 1.2,  0.9,  1.08, 1.0],
    extrapolate: "clamp",
  });
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
      {/* 1. Intro-screen base glow */}
      <IntroScreenGlow />

      {/* 2. Three bloom blobs with breathing oscillation */}
      <BloomBg decoExit={decoExit} reduce={reduce} />

      {/* 3. Floating category pills */}
      {FLOAT_CATS.map((c) => (
        <FloatPill key={c.label} cat={c} decoOpacity={decoOpacity} />
      ))}

      {/* 4. Tap anywhere to skip */}
      <Pressable
        onPress={startExit}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* 5. Avatar with sonar rings + wordmark (pointerEvents none so tap passes through) */}
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
        {/* Avatar area — rings are position:absolute relative to this container */}
        <View>
          {/* Sonar ring 1 */}
          {!reduce && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: RING_SIZE / 2,
                borderWidth: 1.5,
                borderColor: t.accent,
                top: -8,
                left: -8,
                opacity: ring1Opacity,
                transform: [{ scale: ring1Scale }],
              }}
            />
          )}
          {/* Sonar ring 2 */}
          {!reduce && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: RING_SIZE / 2,
                borderWidth: 1.5,
                borderColor: t.accent,
                top: -8,
                left: -8,
                opacity: ring2Opacity,
                transform: [{ scale: ring2Scale }],
              }}
            />
          )}
          {/* Avatar — judToAuth: scale 1→0.7 on exit */}
          <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
            <JudithAvatar persona={persona} size={132} state="listening" />
          </Animated.View>
        </View>

        {/* "Judith" wordmark */}
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

        {/* Tagline — "Due Dates," fades 1.05s; "Handled." punches 1.9s */}
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
