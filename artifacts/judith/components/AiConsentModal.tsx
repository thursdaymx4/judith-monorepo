/**
 * Bottom-sheet modal that discloses every off-device AI processor Judith
 * uses and asks the user's explicit permission before any data is shared.
 *
 * Required by App Store Guidelines 5.1.1(i) + 5.1.2(i). Must list:
 *   - WHAT data is sent (bill context, voice, receipt images)
 *   - WHO receives it (Anthropic, ElevenLabs)
 *   - HOW LONG it's retained (30 days)
 *   - HOW to decline (button on this sheet)
 *
 * The modal is purely presentational — accept/decline + persistence are
 * the caller's responsibility via lib/aiConsent.ts.
 */
import React from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JudithAvatar } from "@/components/JudithAvatar";
import { Low, Muted, Txt } from "@/components/ui";
import { PRIVACY_URL, openLegal } from "@/constants/legal";
import type { PersonaId } from "@/constants/personas";
import { useTheme } from "@/hooks/useTheme";

export interface AiConsentModalProps {
  visible: boolean;
  persona: PersonaId;
  onAccept: () => void;
  onDecline: () => void;
}

export function AiConsentModal({ visible, persona, onAccept, onDecline }: AiConsentModalProps) {
  // persona is a PersonaId at the JS boundary; JudithAvatar's prop is the
  // discriminated PersonaId union. This file accepts the same type for
  // call-site simplicity.
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDecline}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: t.canvas,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 20,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 22,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 14 }}>
            <JudithAvatar persona={persona} size={64} state="speaking" />
          </View>
          <Txt size={20} weight="bold" style={{ textAlign: "center", marginBottom: 6 }}>
            Allow AI features?
          </Txt>
          <Muted size={13} style={{ textAlign: "center", marginBottom: 14 }}>
            Voice, Ask Judith, and receipt scanning use two third-party AI services. Here's what they get.
          </Muted>

          {/* What gets sent — by processor */}
          <Txt size={13} weight="semibold" color={t.txtHi} style={{ marginBottom: 6 }}>
            Anthropic (Claude)
          </Txt>
          <Muted size={13} style={{ marginBottom: 4 }}>• Typed questions you ask Judith</Muted>
          <Muted size={13} style={{ marginBottom: 4 }}>• Bill metadata — provider, amount, due date, paid/unpaid status</Muted>
          <Muted size={13} style={{ marginBottom: 4 }}>• Images you choose to scan (receipts, bill screenshots)</Muted>
          <Muted size={13} style={{ marginBottom: 12 }}>• 30-day trust-and-safety retention · not used to train Claude</Muted>

          <Txt size={13} weight="semibold" color={t.txtHi} style={{ marginBottom: 6 }}>
            ElevenLabs
          </Txt>
          <Muted size={13} style={{ marginBottom: 4 }}>• Voice recordings when you speak to Judith</Muted>
          <Muted size={13} style={{ marginBottom: 4 }}>• Text Judith speaks back to you</Muted>
          <Muted size={13} style={{ marginBottom: 14 }}>• 30-day abuse-review retention · not used to train their voices</Muted>

          {/* Highlighted "we never send" card — visually distinct so it
              reads on a quick skim, per Apple feedback. */}
          <View
            style={{
              backgroundColor: t.accent + "12",
              borderColor: t.accent + "55",
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <Txt size={13} weight="bold" color={t.accent} style={{ marginBottom: 6 }}>
              We never send
            </Txt>
            <Muted size={13} style={{ marginBottom: 3 }}>• Your name or email</Muted>
            <Muted size={13} style={{ marginBottom: 3 }}>• Your account password or auth tokens</Muted>
            <Muted size={13} style={{ marginBottom: 3 }}>• Contacts, calendar, or location</Muted>
            <Muted size={13}>• Payment credentials or card numbers</Muted>
          </View>

          <Low size={11} style={{ textAlign: "left", marginBottom: 16 }}>
            Receipt OCR runs on-device with Apple's Vision framework first — images only leave your phone when on-device recognition fails. Full list and contact info in our{" "}
            <Low size={11} color={t.accent} style={{ textDecorationLine: "underline" }} onPress={() => openLegal(PRIVACY_URL)}>Privacy Policy</Low>.
            Don't Allow keeps Judith working as a bill tracker with reminders and manual entry — no AI features. You can change this any time in Settings.
          </Low>

          <Pressable
            onPress={onAccept}
            style={{
              backgroundColor: t.accent,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Txt size={16} weight="semibold" color={t.onAccent}>Allow</Txt>
          </Pressable>

          <Pressable onPress={onDecline} style={{ paddingVertical: 10, alignItems: "center" }}>
            <Txt size={15} color={t.txtMid}>Don&apos;t Allow</Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
