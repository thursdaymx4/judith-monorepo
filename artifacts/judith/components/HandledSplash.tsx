import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BreathingBackdrop } from "@/components/BreathingBackdrop";
import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { ONBOARDING_WELCOME_LINE, prefetchSpeak } from "@/lib/onboardingAudio";

/**
 * Branded launch experience — covers the screen while the JS bundle warms,
 * fonts load, and contexts hydrate. Drops itself once the host signals
 * `onDone()`. Sized to match the v1 design: dark canvas, soft tri-colour
 * radial blooms, the Judith character in a pulsing green halo, the
 * "Due Dates, Handled." line, and four bill-category chips floating in.
 *
 * Animations run entirely on Reanimated's UI worklet thread so they
 * neither block JS nor regress when the bundle is doing heavy lifting
 * (Sentry init, RevenueCat, Supabase auth, OTA check) underneath.
 */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface Chip {
  label: string;
  icon: IconName;
  /** Background of the icon tile (heavier alpha — should read as a coloured chip). */
  tileBg: string;
  /** The icon stroke colour itself — same hue as the tile but full saturation. */
  iconColor: string;
  /** Absolute position as a fraction of screen size, top-left origin. */
  x: number;
  y: number;
}

const CHIPS: Chip[] = [
  // Amber / lightning
  { label: "Electricity",   icon: "zap",     tileBg: "#f59e0b40", iconColor: "#f59e0b", x: 0.08, y: 0.16 },
  // Purple-ish blue / wifi
  { label: "Internet",      icon: "wifi",    tileBg: "#7c3aed40", iconColor: "#a78bfa", x: 0.62, y: 0.20 },
  // Cyan / droplet
  { label: "Water",         icon: "droplet", tileBg: "#0ea5e940", iconColor: "#38bdf8", x: 0.06, y: 0.70 },
  // Violet / sparkle
  { label: "Subscriptions", icon: "spark",   tileBg: "#a855f740", iconColor: "#c084fc", x: 0.50, y: 0.74 },
];

interface Props {
  /** Called once the splash has fully faded out; parent should swap to the app. */
  onDone: () => void;
}

export function HandledSplash({ onDone }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Persona + language drive the prefetched onboarding voice line. Reading
  // these from the store costs nothing — the provider is already mounted
  // around this component (see app/_layout.tsx).
  const { persona, language } = useJudith();

  // Warm the onboarding Welcome line during the splash hold (~7s of free
  // time). When the user reaches the "Let's begin" screen — usually after
  // signing in, which adds even more buffer — the audio plays without any
  // ElevenLabs round-trip, so the screen stops feeling frozen on first
  // visit. Fire-and-forget; failures are silent inside prefetchSpeak.
  useEffect(() => {
    prefetchSpeak(ONBOARDING_WELCOME_LINE, persona, language);
  }, [persona, language]);

  // ── Shared values for each element ──────────────────────────────────────
  const avatarScale    = useSharedValue(0.7);
  const avatarOpacity  = useSharedValue(0);
  const haloScale      = useSharedValue(1);
  const titleY         = useSharedValue(12);
  const titleOpacity   = useSharedValue(0);
  const subY           = useSharedValue(12);
  const subOpacity     = useSharedValue(0);
  /** Drives the slide-up exit — splash translates a full screen height
   *  upward to leave the viewport without ever going translucent, so
   *  the login underneath is never visible "through" the splash. */
  const exitProgress   = useSharedValue(0);
  // Four explicit hook calls (not a map) so React's hook-order rule sees a
  // stable count regardless of how CHIPS is later reshuffled.
  const chip0 = useSharedValue(0);
  const chip1 = useSharedValue(0);
  const chip2 = useSharedValue(0);
  const chip3 = useSharedValue(0);
  const chipProgress = [chip0, chip1, chip2, chip3];

  useEffect(() => {
    // Blooms are now provided by the persistent BreathingBackdrop in
    // _layout.tsx — they were already alive before this component
    // mounted, so the splash doesn't need to fade them in. We just
    // animate the foreground (avatar + headline + chips).

    // t=200   – avatar pops in
    avatarScale.value   = withDelay(200, withSpring(1, { damping: 14, stiffness: 130 }));
    avatarOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));

    // t=400   – halo starts an infinite gentle pulse
    haloScale.value     = withDelay(400, withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.00, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    ));

    // t=600   – title fades + slides up
    titleY.value        = withDelay(600, withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) }));
    titleOpacity.value  = withDelay(600, withTiming(1, { duration: 250 }));

    // t=750   – subtitle fades + slides up
    subY.value          = withDelay(750, withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) }));
    subOpacity.value    = withDelay(750, withTiming(1, { duration: 250 }));

    // t=900   – chips spring in with stagger
    chipProgress.forEach((sv, i) => {
      sv.value = withDelay(900 + i * 80, withSpring(1, { damping: 15, stiffness: 120 }));
    });

    // Hold the design on-screen, then SLIDE the splash off the top
    // instead of fading. A slide keeps the splash fully opaque the
    // entire time it's visible, so there's never a moment where the
    // login's avatar can be seen "ghosting" behind a half-faded splash.
    // The blooms underneath get revealed cleanly as the splash leaves.
    const HOLD_MS = 5800;
    // 1600ms with the iOS-style decel curve (0.32, 0.72, 0, 1) — a
    // single long deceleration with no acceleration phase at the start
    // and no abrupt slow-down at the end. The whole slide reads as
    // ONE smooth gesture instead of "speed up then brake," which is
    // what makes Easing.inOut feel jerky on long full-screen moves.
    // This is the same curve UIKit's UIView.animate "ease out" uses
    // for system transitions like sheet dismissals.
    const FADE_MS = 1600;
    exitProgress.value = withDelay(
      HOLD_MS,
      withTiming(1, {
        duration: FADE_MS,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      }),
    );

    // Unmount on the JS thread once the fade has finished. A setTimeout is
    // cleaner here than runOnJS-from-worklet because React state setters
    // must run on JS — and we want a guaranteed dismissal even if a frame
    // is dropped during the fade.
    const handle = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => clearTimeout(handle);
  }, []);

  // ── Animated styles ─────────────────────────────────────────────────────
  // Shared-element transition: background (blooms + chips + headline) fades
  // out while the avatar persists and morphs to the login's avatar spot.
  // This makes Judith herself the through-line — the only constant element
  // across boot → sign-in, so the user remembers her face above all else.

  // Target destination for the avatar at end of exit. Computed from
  // login.tsx's actual layout: ScrollView paddingTop = insets.top + 40,
  // avatar wrapper has no marginTop, avatar size 92 → center sits at
  // insets.top + 40 + 46. Using insets (not a screen-height fraction) so
  // the avatar lands on the login avatar's true Y regardless of device
  // (notch vs. dynamic island vs. no-notch).
  const LOGIN_AVATAR_SCALE = 92 / 120; // 92pt target / 120pt source
  const splashCenterY = SCREEN_H * 0.5;
  const loginAvatarY  = insets.top + 40 + 46;
  const avatarTravelY = loginAvatarY - splashCenterY; // negative — moves up

  const rootStyle      = useAnimatedStyle(() => ({}));

  // The fading layer (background canvas + blooms + chips + headline +
  // subtitle + halo) cross-fades to opacity 0 as exitProgress goes 0→1.
  const fadingLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - exitProgress.value,
  }));

  const avatarStyle    = useAnimatedStyle(() => {
    // Two phases interleaved:
    //   Entrance (avatarScale + avatarOpacity): standard spring-in on mount
    //   Exit (exitProgress): translate up to login's avatar Y and scale to 92pt
    const exitScale = 1 + (LOGIN_AVATAR_SCALE - 1) * exitProgress.value;
    const exitY     = avatarTravelY * exitProgress.value;
    return {
      opacity: avatarOpacity.value,
      transform: [
        { translateY: exitY },
        { scale: avatarScale.value * exitScale },
      ],
    };
  });
  const haloStyle      = useAnimatedStyle(() => ({
    opacity: avatarOpacity.value * 0.55 * (1 - exitProgress.value),
    transform: [{ scale: haloScale.value }],
  }));
  const titleStyle     = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subStyle       = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
    transform: [{ translateY: subY.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.root, rootStyle]}>
      {/* ── Fading layer: everything EXCEPT the avatar ──────────────────
          During exit, this layer cross-fades to 0 while the avatar below
          travels to login's position. Result: a "shared element"
          transition where Judith's face is the only constant, settling
          into place at sign-in. */}
      <Animated.View style={[StyleSheet.absoluteFill, fadingLayerStyle]} pointerEvents="none">
        {/* Splash-local backdrop — dark canvas + blooms. Identical to the
            one mounted at root in _layout.tsx; both started at the same
            moment so their Reanimated worklets produce identical values
            on every frame. */}
        <BreathingBackdrop />

        {/* Floating category chips */}
        {CHIPS.map((c, i) => (
          <FloatingChip
            key={c.label}
            chip={c}
            progress={chipProgress[i]!}
            theme={t}
          />
        ))}

        {/* Headline + subtitle — anchored absolutely BELOW the avatar.
            Previously this used a flex:1 centered container with a
            150×150 placeholder, but the flex math vertically centred
            the whole block (placeholder + title + sub), which put the
            title's top at ~SCREEN_H/2 + 47 while the avatar's bottom
            sits at SCREEN_H/2 + 60 — a 13px overlap with the word
            "Judith". Anchoring the text relative to the avatar's
            known absolute position eliminates that ambiguity. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: splashCenterY + 60,      // avatar bottom; title's marginTop adds the gap
            left: 0,
            right: 0,
            alignItems: "center",
            paddingHorizontal: 32,
          }}
        >
          <Animated.Text style={[styles.title, { color: "#ffffff", fontFamily: t.fonts.bold }, titleStyle]}>
            Judith
          </Animated.Text>

          <Animated.Text style={[styles.sub, { color: "rgba(255,255,255,0.72)", fontFamily: t.fonts.medium }, subStyle]}>
            Due Dates,{" "}
            <Animated.Text style={{ color: t.accent, fontFamily: "PlayfairDisplay_800ExtraBold_Italic" }}>
              Handled.
            </Animated.Text>
          </Animated.Text>
        </View>

        {/* Halo around the avatar — fades with the rest of the background */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: splashCenterY - 72,
              left: SCREEN_W / 2 - 72,
            },
            styles.halo,
            { borderColor: t.accent },
            haloStyle,
          ]}
        />
      </Animated.View>

      {/* ── Persistent avatar: doesn't fade, just translates + scales ─── */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: splashCenterY - 60,    // 120/2 = 60 → centered vertically
            left: SCREEN_W / 2 - 60,    // horizontally centered
            width: 120,
            height: 120,
          },
          avatarStyle,
        ]}
      >
        {/* Hardcoded to "pro" — the Professional Peer: black hair,
            square glasses, collared shirt. The login also renders a
            "pro" avatar at size 92 in the same screen-Y position, so
            when this splash unmounts the login's avatar takes over in
            the same spot — the user perceives ONE continuous Judith. */}
        <JudithAvatar persona="pro" size={120} state="idle" />
      </Animated.View>
    </Animated.View>
  );
}

// ── Floating chip subcomponent ─────────────────────────────────────────────

function FloatingChip({
  chip,
  progress,
  theme,
}: {
  chip: Chip;
  progress: Animated.SharedValue<number>;
  theme: ReturnType<typeof useTheme>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: 0.85 + progress.value * 0.15 },
      { translateY: (1 - progress.value) * 8 },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          left: chip.x * SCREEN_W,
          top:  chip.y * SCREEN_H,
          // Splash is ALWAYS on the dark canvas, so the chip background must
          // be theme-independent — using surface2 means light-mode users got
          // a white-ish tile that obscured the blooms behind. A very-low-alpha
          // white frost reads the same way in either theme and keeps the
          // bloom gradients visible through the chip.
          backgroundColor: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.10)",
        },
        style,
      ]}
    >
      <View style={[styles.chipIconWrap, { backgroundColor: chip.tileBg }]}>
        <Icon name={chip.icon} size={14} color={chip.iconColor} strokeWidth={2.2} />
      </View>
      <Animated.Text style={{ color: "#f5f5f4", fontFamily: theme.fonts.medium, fontSize: 13 }}>
        {chip.label}
      </Animated.Text>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  halo: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 2.5,
  },
  title: {
    fontSize: 36,
    marginTop: 22,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 15,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  chip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipIconWrap: {
    width: 26,
    height: 26,
    // Rounded square matches the reference design — softer than a full
    // circle, harder than the chip's outer pill, giving the icon a sense
    // of its own container.
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default HandledSplash;
