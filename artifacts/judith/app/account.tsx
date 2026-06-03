import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Modal, Pressable, Share, Text, TextInput, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { Dot, Low, Mono, Screen, SheetHeader, Txt, mix } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useJudith } from "@/contexts/JudithStore";
import { verifyBiometricsNow } from "@/hooks/useBiometricLock";
import { useTheme } from "@/hooks/useTheme";
import { deleteAccount as deleteAccountRemote } from "@/lib/proxy";
import { restorePurchases as restorePurchasesRemote } from "@/lib/purchases";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontFamily: t.fonts.medium,
        fontSize: 13,
        color: t.txtMid,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

function IcoBox({
  name,
  color,
  borderColor,
}: {
  name: IconName;
  color: string;
  borderColor?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: borderColor ?? t.hair,
        backgroundColor: t.surface3,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={17} color={color} />
    </View>
  );
}

function Row({
  icon,
  iconColor,
  title,
  titleColor,
  subtitle,
  right,
  onPress,
  first,
}: {
  icon: IconName;
  iconColor?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
}) {
  const t = useTheme();
  const body = (
    <>
      <IcoBox name={icon} color={iconColor ?? t.txtMid} />
      <View style={{ flex: 1 }}>
        <Txt size={15} weight="medium" color={titleColor}>
          {title}
        </Txt>
        {subtitle ? (
          <Low size={12} style={{ marginTop: 1 }}>
            {subtitle}
          </Low>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chev" size={16} color={t.txtMid} /> : null)}
    </>
  );
  const style = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: t.hair,
    borderTopWidth: first ? 1 : 0,
    backgroundColor: t.surface2,
  };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: t.surface3 }]}>
      {body}
    </Pressable>
  );
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 46,
        height: 28,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: on ? t.accent : t.hair,
        backgroundColor: on ? t.accent : t.surface3,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#fff",
          transform: [{ translateX: on ? 18 : 0 }],
        }}
      />
    </Pressable>
  );
}

export default function AccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    name,
    setName,
    country,
    tier,
    money,
    bills,
    faceIdLock,
    setFaceIdLock,
    guest,
    setGuest,
    restart,
    subscribe,
    showToast,
  } = useJudith();

  const email = user?.email ?? (guest ? "Guest account" : "—");
  const provider = (user?.app_metadata?.provider as string | undefined) ?? "email";
  const hasPassword = provider === "email";

  const [editOpen, setEditOpen] = React.useState(false);
  const [editVal, setEditVal] = React.useState(name);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteText, setDeleteText] = React.useState("");
  const canDelete = deleteText.trim().toLowerCase() === "delete";

  const subLabel =
    tier === "voice"
      ? "Voice Ask · " + money(199) + "/mo · Active"
      : tier === "chat"
        ? "Chat Ask · " + money(99) + "/mo · Active"
        : "Free · 8 asks to try both modes";

  const openEdit = () => {
    setEditVal(name);
    setEditOpen(true);
  };
  const saveEdit = () => {
    setName(editVal.trim());
    setEditOpen(false);
    showToast("Name updated ✓");
  };

  const changePassword = () => {
    showToast("We’ll email you a reset link");
  };
  const [restoring, setRestoring] = React.useState(false);
  const restorePurchases = async () => {
    setRestoring(true);
    try {
      const restoredTier = await restorePurchasesRemote();
      if (restoredTier !== "free") {
        subscribe(restoredTier);
        showToast("Purchases restored ✓");
      } else {
        showToast("No previous purchases found");
      }
    } catch {
      showToast("Couldn’t restore — try again");
    } finally {
      setRestoring(false);
    }
  };

  const toggleFaceId = async () => {
    if (faceIdLock) {
      setFaceIdLock(false);
      return;
    }
    const ok = await verifyBiometricsNow();
    if (ok) {
      setFaceIdLock(true);
    } else {
      showToast("Face ID not available on this device");
    }
  };

  const exportData = async () => {
    if (bills.length === 0) {
      showToast("No bills to export yet");
      return;
    }
    const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
    const header = "Provider,Category,Amount,Due,Status,Paid";
    const rows = bills.map((b) =>
      [
        esc(b.provider),
        esc(b.cat),
        b.amount,
        esc(b.dueLabel),
        esc(b.status),
        b.amountPaid ?? 0,
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    try {
      await Share.share({ title: "Judith — bills & history", message: csv });
    } catch {
      /* user dismissed */
    }
  };

  const logOut = async () => {
    await signOut();
    setGuest(false);
  };

  const [deleting, setDeleting] = React.useState(false);
  const deleteAccount = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      // Guests have no server account — just clear local data.
      if (!guest) {
        await deleteAccountRemote();
      }
      // Sign out (and end guest mode) BEFORE clearing local data so the auth
      // gate routes straight to the auth screen instead of flashing onboarding.
      await signOut();
      setGuest(false);
      restart();
      setDeleteOpen(false);
      setDeleteText("");
    } catch {
      showToast("Couldn’t delete your account — try again");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 14, paddingBottom: 32 }}>
      <SheetHeader title="Account" onClose={() => router.back()} />

      {/* profile card */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          marginTop: 6,
          padding: 16,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: t.radius.md,
          backgroundColor: t.surface2,
        }}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mix(t.accent, t.surface3, 0.18),
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.4),
          }}
        >
          <Text style={{ fontFamily: t.fonts.bold, fontSize: 20, color: t.accent }}>
            {initialsOf(name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={17} weight="semibold">
            {name || "Add your name"}
          </Txt>
          <Low size={13} style={{ marginTop: 2 }}>
            {email}
          </Low>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Text style={{ fontSize: 14 }}>{country.flag}</Text>
            <Low size={12}>{country.name}</Low>
          </View>
        </View>
        <Pressable
          onPress={openEdit}
          style={({ pressed }) => [
            {
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: t.hair,
              backgroundColor: t.surface3,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Txt size={13} weight="semibold" color={t.accent}>
            Edit
          </Txt>
        </Pressable>
      </View>

      {/* security */}
      <SectionLabel>Security</SectionLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        <Row
          first
          icon="sliders"
          iconColor={faceIdLock ? t.accent : t.txtMid}
          title="Unlock with Face ID"
          subtitle="Require Face ID or PIN to open Judith"
          right={<Toggle on={faceIdLock} onPress={toggleFaceId} />}
        />
        {hasPassword && (
          <Row icon="card" title="Change password" subtitle="Email yourself a reset link" onPress={changePassword} />
        )}
      </View>

      {/* subscription */}
      <SectionLabel>Subscription</SectionLabel>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderWidth: 1,
          borderColor: mix(t.accent, t.surface2, 0.3),
          borderRadius: t.radius.md,
          backgroundColor: mix(t.accent, t.surface2, 0.14),
          padding: 16,
        }}
      >
        <IcoBox name={tier !== "free" ? "star" : "spark"} color={t.accent} borderColor={mix(t.accent, t.surface2, 0.4)} />
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="semibold">
            {tier === "voice" ? "Voice Ask" : tier === "chat" ? "Chat Ask" : "Ask Judith"}
          </Txt>
          <Low size={12}>
            {tier === "voice" ? (
              <><Mono size={12}>{money(199)}</Mono> · Monthly</>
            ) : tier === "chat" ? (
              <><Mono size={12}>{money(99)}</Mono> · Monthly</>
            ) : (
              <>8 free asks included</>
            )}
          </Low>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          {tier !== "free" && <Dot kind="ok" />}
          <Txt size={12} color={tier !== "free" ? t.semantic.ok : t.txtMid}>
            {tier !== "free" ? "Active" : "Free"}
          </Txt>
        </View>
      </View>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden", marginTop: 9 }}>
        <Row
          first
          icon="spark"
          iconColor={t.accent}
          title="Ask Judith plan"
          subtitle={subLabel}
          onPress={() => router.push("/plans")}
        />
        <Row icon="wallet" title="Restore purchases" subtitle="Recover a previous subscription" onPress={restoring ? undefined : restorePurchases} right={restoring ? <ActivityIndicator size="small" color={t.txtMid} /> : undefined} />
      </View>

      {/* data */}
      <SectionLabel>Your data</SectionLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        <Row
          first
          icon="grid"
          title="Export bills & history"
          subtitle="Download everything as a CSV"
          onPress={exportData}
        />
      </View>

      {/* danger */}
      <SectionLabel>Account</SectionLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        <Row first icon="globe" title="Log out" subtitle="Sign out of this device" onPress={logOut} />
        <Row
          icon="trenddown"
          iconColor="#ff645f"
          title="Delete account"
          titleColor="#ff645f"
          subtitle="Permanently remove your data"
          onPress={() => setDeleteOpen(true)}
        />
      </View>

      <View style={{ alignItems: "center", marginTop: 22 }}>
        <Low size={12}>Judith v1.0 · Made for the Philippines</Low>
      </View>

      {/* edit-name modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)} statusBarTranslucent>
        <Pressable
          onPress={() => setEditOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 26 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, borderRadius: 18, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, padding: 22 }}
          >
            <Text style={{ fontFamily: t.fonts.semibold, fontSize: 19, color: t.txtHi, letterSpacing: -0.3, marginBottom: 12 }}>
              What should Judith call you?
            </Text>
            <TextInput
              value={editVal}
              onChangeText={setEditVal}
              placeholder="Your name"
              placeholderTextColor={t.txtLow}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              style={{
                fontFamily: t.fonts.medium,
                fontSize: 16,
                color: t.txtHi,
                borderWidth: 1,
                borderColor: editVal.trim() ? t.accent : t.hair,
                backgroundColor: t.surface3,
                borderRadius: 11,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={() => setEditOpen(false)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 11, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface3 }}
              >
                <Txt size={14} weight="medium">
                  Cancel
                </Txt>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 11, backgroundColor: t.accent }}
              >
                <Txt size={14} weight="semibold" color={t.onAccent}>
                  Save
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* delete-account modal */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)} statusBarTranslucent>
        <Pressable
          onPress={() => setDeleteOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 26 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, borderRadius: 18, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, padding: 22 }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix("#ff645f", t.surface2, 0.16),
                borderWidth: 1,
                borderColor: mix("#ff645f", t.surface2, 0.4),
                marginBottom: 14,
              }}
            >
              <Icon name="trenddown" size={22} color="#ff645f" />
            </View>
            <Text style={{ fontFamily: t.fonts.semibold, fontSize: 19, color: t.txtHi, letterSpacing: -0.3, marginBottom: 8 }}>
              Delete your account?
            </Text>
            <Low size={13} style={{ lineHeight: 19 }}>
              This permanently removes{" "}
              <Low size={13} weight="medium" color={t.txtHi}>
                all {bills.length} of your bills
              </Low>{" "}
              and signs you out. This can&rsquo;t be undone.
            </Low>
            <Low size={12} style={{ marginTop: 16, marginBottom: 7 }}>
              Type{" "}
              <Low size={12} weight="medium" color={t.txtHi}>
                delete
              </Low>{" "}
              to confirm
            </Low>
            <TextInput
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder="delete"
              placeholderTextColor={t.txtLow}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                fontFamily: t.fonts.medium,
                fontSize: 15,
                color: t.txtHi,
                borderWidth: 1,
                borderColor: canDelete ? "#ff645f" : t.hair,
                backgroundColor: t.surface3,
                borderRadius: 11,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={() => setDeleteOpen(false)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 11, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface3 }}
              >
                <Txt size={14} weight="medium">
                  Cancel
                </Txt>
              </Pressable>
              <Pressable
                onPress={deleteAccount}
                disabled={!canDelete}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 13,
                  borderRadius: 11,
                  backgroundColor: canDelete ? "#ff645f" : mix("#ff645f", t.surface2, 0.3),
                  opacity: canDelete ? 1 : 0.5,
                }}
              >
                <Txt size={14} weight="semibold" color="#ffffff">
                  Delete account
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
