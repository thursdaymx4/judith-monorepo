/**
 * Explainer sheet for the Altitude grading system.
 *
 * Surfaces:
 *   - the user's current bills-to-income ratio as a percentage
 *   - the full band table (10 bands, % thresholds, rank names)
 *   - a short note on what's counted (bills only — not taxes, food, etc.)
 *
 * Per spec, the level number is never shown in the main UI. The percentage
 * is fine — it's a derived signal that explains the grade WITHOUT
 * revealing the level directly. The user asked to see the math.
 */
import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { MiniHex } from "@/components/altitude/MiniHex";
import { Low, RoundBtn, Txt } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import {
  RATIO_BANDS,
  levelMeta,
  tierForLevel,
} from "@/lib/altitude";

interface GradingExplainerProps {
  visible: boolean;
  onClose: () => void;
  /** 0..1 if known; null when no income is set. */
  ratio: number | null;
  /** Current level so we can highlight the matching row. */
  currentLevel: number;
}

export function GradingExplainer({
  visible,
  onClose,
  ratio,
  currentLevel,
}: GradingExplainerProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const pct = ratio != null ? Math.round(ratio * 100) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View
          style={{
            maxHeight: "88%",
            backgroundColor: t.canvas,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingBottom: 6,
            }}
          >
            <View style={{ width: 32 }} />
            <Txt size={16} weight="bold" color={t.txtHi}>
              How your altitude works
            </Txt>
            <RoundBtn icon="x" onPress={onClose} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Current-ratio summary card */}
            {pct != null ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: t.surface1,
                  borderWidth: 1,
                  borderColor: t.hair,
                  gap: 6,
                }}
              >
                <Low size={11} style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>
                  Right now
                </Low>
                <Txt size={28} weight="bold" color={tierForLevel(currentLevel).color}>
                  {pct}%
                </Txt>
                <Low size={13}>
                  of your monthly income goes to tracked bills.
                </Low>
              </View>
            ) : (
              <View
                style={{
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: t.surface1,
                  borderWidth: 1,
                  borderColor: t.hair,
                  gap: 4,
                }}
              >
                <Low size={11} style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>
                  Set your income first
                </Low>
                <Low size={13}>
                  We can't grade without knowing what's coming in. Add your monthly income from Settings → Account.
                </Low>
              </View>
            )}

            {/* How it's calculated */}
            <View style={{ gap: 6 }}>
              <Txt size={14} weight="semibold" color={t.txtHi}>
                What we measure
              </Txt>
              <Low size={13}>
                bills ÷ income. We sum every recurring bill you track and divide by your monthly income. Annual bills count as 1⁄12, one-time bills count as their amount spread over the 12 months leading up to their due date.
              </Low>
              <Low size={13} style={{ marginTop: 6 }}>
                What's <Txt size={13} weight="semibold" color={t.txtHi}>not</Txt> counted: taxes, food, transport, savings, discretionary spending. So the ratio is naturally lower than your true "money in vs. money out" — the grade penalizes you a bit at the same level to reflect that real headroom is smaller than it looks.
              </Low>
            </View>

            {/* Band table */}
            <View style={{ gap: 6 }}>
              <Txt size={14} weight="semibold" color={t.txtHi}>
                The bands
              </Txt>
              <View
                style={{
                  borderRadius: 14,
                  backgroundColor: t.surface1,
                  borderWidth: 1,
                  borderColor: t.hair,
                  overflow: "hidden",
                }}
              >
                {RATIO_BANDS.map((b, i) => {
                  const isCurrent = b.level === currentLevel;
                  const meta = levelMeta(b.level);
                  const tier = tierForLevel(b.level);
                  return (
                    <View
                      key={b.level}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: isCurrent ? tier.color + "1c" : "transparent",
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: t.hair,
                      }}
                    >
                      <MiniHex level={b.level} size={28} />
                      <View style={{ flex: 1 }}>
                        <Txt size={13} weight={isCurrent ? "bold" : "semibold"} color={t.txtHi}>
                          {meta.rank}
                        </Txt>
                        <Low size={11}>{tier.name}</Low>
                      </View>
                      <Txt size={13} weight={isCurrent ? "bold" : "semibold"} color={isCurrent ? tier.color : t.txtMid}>
                        {b.label}
                      </Txt>
                      {isCurrent ? (
                        <Icon name="check" size={14} color={tier.color} />
                      ) : (
                        <View style={{ width: 14 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Waterline note */}
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#1FC2CC15",
                borderWidth: 1,
                borderColor: "#1FC2CC55",
              }}
            >
              <Txt size={12} weight="bold" color="#1FC2CC" style={{ letterSpacing: 1 }}>
                THE WATERLINE
              </Txt>
              <Low size={12} style={{ marginTop: 4 }}>
                Treading Water (42–54%) is the paycheck-to-paycheck line. Below it you have room to save; above it you're stretched, even if you don't feel it yet — taxes and essentials eat the rest of the month.
              </Low>
            </View>

            <Low size={11} style={{ textAlign: "center", marginTop: 4 }}>
              Bands are derived from the standard 28/36 housing-DTI guideline and HUD's rent-burden thresholds, extended to cover all fixed bills.
            </Low>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
