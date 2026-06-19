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
          <Txt size={20} weight="bold" style={{ textAlign: "center", marginBottom: 10 }}>
            Before Judith uses AI
          </Txt>

          <Muted size={14} style={{ textAlign: "left", marginBottom: 12 }}>
            <Txt size={14} weight="semibold">Anthropic (Claude)</Txt> processes
            text and image inputs to answer your questions, parse spoken
            bill descriptions, and extract details from bill screenshots
            and receipt photos. We send your bill context (provider name,
            amount, due date, payment status), your typed questions, and
            the images you choose to scan. Inputs are retained by Anthropic
            for up to 30 days for trust-and-safety review and are not used
            to train their models.
          </Muted>

          <Muted size={14} style={{ textAlign: "left", marginBottom: 12 }}>
            <Txt size={14} weight="semibold">ElevenLabs</Txt> transcribes
            your voice into text and synthesizes Judith's spoken replies
            when you use voice features. Audio is retained by ElevenLabs
            for up to 30 days for abuse review and is not used to train
            their models.
          </Muted>

          <Muted size={14} style={{ textAlign: "left", marginBottom: 16 }}>
            We never send your name, email, contacts, payment credentials,
            or account password to either service. Receipt OCR runs first
            on-device using Apple's Vision framework — the image only
            leaves your phone if your device can't read it locally.
          </Muted>

          <Low size={11} style={{ textAlign: "left", marginBottom: 18 }}>
            See the full list of processors in our{" "}
            <Low size={11} color={t.accent} style={{ textDecorationLine: "underline" }} onPress={() => openLegal(PRIVACY_URL)}>Privacy Policy</Low>.
            You can decline and still use Judith — bill tracking, reminders,
            and manual entry work without any AI features.
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
            <Txt size={16} weight="semibold" color={t.onAccent}>I agree, continue</Txt>
          </Pressable>

          <Pressable onPress={onDecline} style={{ paddingVertical: 10, alignItems: "center" }}>
            <Txt size={15} color={t.txtMid}>Not now</Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
