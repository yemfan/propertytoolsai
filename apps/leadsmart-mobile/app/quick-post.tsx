import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import {
  fetchMobileQuickPostDraft,
  type MobileQuickPostPlatform,
  type MobileQuickPostTrigger,
} from "../lib/leadsmartMobileApi";
import {
  hapticButtonPress,
  hapticError,
  hapticSuccess,
} from "../lib/haptics";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

/**
 * Mobile Quick Post — Phase 1 (draft only).
 *
 * The agent picks a trigger ("New listing", "Open house", …),
 * picks a target platform, types a short brief (or pastes
 * listing details), and taps Generate. Claude returns a
 * platform-aware caption + hashtags that the agent can copy or
 * share into the native FB / IG / LinkedIn / X app.
 *
 * Why draft-only on mobile (for now):
 *   - Direct publish via Meta Graph API needs a per-agent OAuth
 *     grant. On web this lives at /api/leads-gen/connect/meta;
 *     porting the OAuth deep-link round-trip to the mobile app
 *     is its own ship. Until then, copy + share into the platform
 *     app is the right path — and faster than typing on a phone
 *     keyboard from scratch.
 *   - Free agents see a 402 from the draft API and can upgrade
 *     in the web app. Mobile doesn't block at the UI level so
 *     the upsell path is the inline error.
 */

type TriggerOption = {
  id: MobileQuickPostTrigger;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TRIGGERS: TriggerOption[] = [
  { id: "new_listing", label: "New listing", icon: "home-outline" },
  { id: "open_house", label: "Open house", icon: "calendar-outline" },
  { id: "price_drop", label: "Price drop", icon: "trending-down-outline" },
  { id: "just_sold", label: "Just sold", icon: "trophy-outline" },
  { id: "market_update", label: "Market update", icon: "stats-chart-outline" },
  { id: "testimonial", label: "Testimonial", icon: "chatbox-ellipses-outline" },
  { id: "custom", label: "Custom", icon: "sparkles-outline" },
];

type PlatformOption = {
  id: MobileQuickPostPlatform;
  label: string;
};

const PLATFORMS: PlatformOption[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
];

export default function QuickPostScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [trigger, setTrigger] = useState<MobileQuickPostTrigger>("new_listing");
  const [platform, setPlatform] = useState<MobileQuickPostPlatform>("facebook");
  const [brief, setBrief] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const onGenerate = useCallback(async () => {
    const trimmed = brief.trim();
    if (!trimmed) {
      setError(
        trigger === "custom" ||
          trigger === "market_update" ||
          trigger === "testimonial"
          ? "Tell me what the post should be about."
          : "Add a brief — what's the address, the angle, anything special?",
      );
      hapticError();
      return;
    }
    hapticButtonPress();
    setBusy(true);
    setError(null);
    const res = await fetchMobileQuickPostDraft({
      trigger,
      platform,
      brief: trimmed,
    });
    setBusy(false);
    if (res.ok === false) {
      hapticError();
      setError(res.message);
      return;
    }
    hapticSuccess();
    setCaption(res.caption);
    setHashtags(res.hashtags);
    setGenerated(true);
  }, [trigger, platform, brief]);

  const onShare = useCallback(async () => {
    if (!caption) return;
    hapticButtonPress();
    // Per-platform: IG already gets hashtags inlined by the model.
    // For FB/LinkedIn/X, append the hashtag tokens at the end so the
    // single payload includes everything the agent might want to share.
    const inlineTags =
      platform === "instagram" || hashtags.length === 0
        ? ""
        : `\n\n${hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}`;
    try {
      // Native Share sheet — gives the agent Copy + per-app share
      // (Messages, FB app, IG, etc.) in one tap. Avoids pulling
      // expo-clipboard as a native dependency.
      await Share.share({ message: caption + inlineTags });
      hapticSuccess();
    } catch {
      hapticError();
      Alert.alert("Share failed", "Couldn't open the share sheet.");
    }
  }, [caption, hashtags, platform]);

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <Stack.Screen options={{ title: "Quick Post", headerBackTitle: "Back" }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Trigger picker */}
        <Text style={styles.sectionLabel}>What&apos;s this about?</Text>
        <View style={styles.triggerGrid}>
          {TRIGGERS.map((t) => {
            const active = trigger === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTrigger(t.id);
                  setGenerated(false);
                  hapticButtonPress();
                }}
                style={[
                  styles.triggerChip,
                  active && styles.triggerChipActive,
                ]}
              >
                <Ionicons
                  name={t.icon}
                  size={18}
                  color={active ? tokens.accent : tokens.text}
                />
                <Text
                  style={[
                    styles.triggerChipText,
                    active && styles.triggerChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Brief */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
          {trigger === "custom" ||
          trigger === "market_update" ||
          trigger === "testimonial"
            ? "Brief"
            : "Details (address, price, angle)"}
        </Text>
        <TextInput
          style={styles.briefInput}
          placeholder={placeholderFor(trigger)}
          placeholderTextColor={tokens.textSubtle}
          multiline
          value={brief}
          onChangeText={setBrief}
          textAlignVertical="top"
        />

        {/* Platform tabs */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
          Platform
        </Text>
        <View style={styles.platformRow}>
          {PLATFORMS.map((p) => {
            const active = platform === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  setPlatform(p.id);
                  setGenerated(false);
                  hapticButtonPress();
                }}
                style={[
                  styles.platformTab,
                  active && styles.platformTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.platformTabText,
                    active && styles.platformTabTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Generate button */}
        <Pressable
          onPress={onGenerate}
          disabled={busy}
          style={[styles.generateButton, busy && styles.generateButtonBusy]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.generateButtonText}>
                {generated ? "Regenerate" : "Generate"}
              </Text>
            </>
          )}
        </Pressable>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={tokens.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Generated caption */}
        {generated && caption && (
          <View style={styles.captionCard}>
            <Text style={styles.captionLabel}>Caption</Text>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
              multiline
              textAlignVertical="top"
            />
            {hashtags.length > 0 && platform !== "instagram" && (
              <View style={styles.hashtagRow}>
                {hashtags.map((h) => (
                  <View key={h} style={styles.hashtagChip}>
                    <Text style={styles.hashtagChipText}>
                      #{h.replace(/^#/, "")}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.actionRow}>
              <Pressable onPress={onShare} style={styles.actionButton}>
                <Ionicons
                  name="share-outline"
                  size={16}
                  color={tokens.accent}
                />
                <Text style={styles.actionButtonText}>Share / Copy</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              Direct publish from the mobile app is coming soon. For now,
              share into the {labelFor(platform)} app or use Copy from the
              share sheet.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function placeholderFor(t: MobileQuickPostTrigger): string {
  switch (t) {
    case "new_listing":
      return "e.g. 123 Main St, Pasadena. 3bd 2ba, $1.2M. Modern reno, walk to Old Town.";
    case "open_house":
      return "e.g. 123 Main St, Saturday 1-4pm. Light bites + coffee, brand-new kitchen.";
    case "price_drop":
      return "e.g. 123 Main St — down from $1.45M to $1.39M. Motivated seller.";
    case "just_sold":
      return "e.g. Closed 123 Main St in 14 days, multiple offers. Repeat client.";
    case "market_update":
      return "e.g. Inventory in Pasadena up 18% MoM, rates eased below 6.5%. Buyers are back.";
    case "testimonial":
      return 'e.g. Sarah said "Mike made the whole process easy — closed in under 30 days, $15k off asking."';
    case "custom":
      return "Describe the post — angle, tone, anything specific to include.";
  }
}

function labelFor(p: MobileQuickPostPlatform): string {
  return PLATFORMS.find((x) => x.id === p)?.label ?? p;
}

function createStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    kav: { flex: 1, backgroundColor: tokens.bg },
    scrollContent: {
      padding: 16,
      paddingBottom: 48,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: tokens.text,
      marginBottom: 8,
    },
    triggerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    triggerChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: tokens.surface,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    triggerChipActive: {
      backgroundColor: tokens.accentLight,
      borderColor: tokens.accent,
    },
    triggerChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: tokens.text,
    },
    triggerChipTextActive: {
      color: tokens.accent,
    },
    briefInput: {
      minHeight: 96,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.surface,
      padding: 12,
      fontSize: 14,
      color: tokens.text,
    },
    platformRow: {
      flexDirection: "row",
      gap: 6,
    },
    platformTab: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.surface,
      alignItems: "center",
    },
    platformTabActive: {
      backgroundColor: tokens.accentLight,
      borderColor: tokens.accent,
    },
    platformTabText: {
      fontSize: 12,
      fontWeight: "600",
      color: tokens.text,
    },
    platformTabTextActive: {
      color: tokens.accent,
    },
    generateButton: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: tokens.accent,
    },
    generateButtonBusy: {
      opacity: 0.7,
    },
    generateButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
    },
    errorBox: {
      marginTop: 12,
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      padding: 10,
      borderRadius: 8,
      backgroundColor: tokens.dangerBg,
      borderWidth: 1,
      borderColor: tokens.danger,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: tokens.danger,
    },
    captionCard: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      backgroundColor: tokens.surface,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    captionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: tokens.textSubtle,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    captionInput: {
      minHeight: 120,
      fontSize: 14,
      lineHeight: 20,
      color: tokens.text,
      backgroundColor: tokens.bg,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    hashtagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10,
    },
    hashtagChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: tokens.bg,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    hashtagChipText: {
      fontSize: 11,
      color: tokens.textSubtle,
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: tokens.accentLight,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: tokens.accent,
    },
    helperText: {
      marginTop: 10,
      fontSize: 11,
      color: tokens.textSubtle,
      lineHeight: 16,
    },
  });
}
