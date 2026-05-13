import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { Stack, useRouter } from "expo-router";
import {
  fetchMobileConnections,
  fetchMobileQuickPostDraft,
  publishMobileQuickPost,
  type MobileConnection,
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
 * Mobile Quick Post — Phase 2 (direct publish + draft).
 *
 * The agent picks a trigger ("New listing", "Open house", …),
 * picks a target platform, types a short brief, and taps
 * Generate. Claude returns a platform-aware caption + hashtags
 * that the agent can publish directly (when a Meta Page is
 * connected) or Share/Copy into the native app (LinkedIn / X, or
 * any platform without a connection).
 *
 * Direct publish path:
 *   - Hits /api/mobile/leads-gen/publish via shared `publishPost`
 *     helper. Same surface area as the web wizard's Publish
 *     button — supports FB Page feed (text-only or text+image)
 *     and IG Business (requires image).
 *   - On mobile, no media picker yet → IG falls back to
 *     Share/Copy; FB allows text-only direct publish.
 *
 * Connection management: a "Connect Facebook" link routes to the
 * connect-platforms screen which runs the OAuth deep-link round
 * trip. Once connected, the publish button replaces the
 * Share/Copy CTA inline.
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
  const router = useRouter();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [trigger, setTrigger] = useState<MobileQuickPostTrigger>("new_listing");
  const [platform, setPlatform] = useState<MobileQuickPostPlatform>("facebook");
  const [brief, setBrief] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  // Connection state — fetched once on mount. When a Meta Page is
  // connected, the action row shows "Publish to Facebook"; when a
  // LinkedIn member is connected, "Publish to LinkedIn". Empty list
  // → fall back to Share/Copy.
  const [connections, setConnections] = useState<MobileConnection[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<
    | {
        ok: true;
        externalPostUrl: string | null;
        platform: "facebook" | "instagram" | "linkedin";
      }
    | { ok: false; error: string }
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMobileConnections().then((res) => {
      if (cancelled) return;
      if (res.ok === true) setConnections(res.connections);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Which platforms the agent can publish directly to right now.
  // Mobile supports text-only Facebook + LinkedIn posts (no media
  // picker yet); Instagram requires an image (Meta API) so it falls
  // back to Share/Copy even when connected.
  const fbConnection = useMemo(
    () =>
      connections.find((c) => c.platform === "meta" && c.canPublishFacebook) ??
      null,
    [connections],
  );
  const linkedinConnection = useMemo(
    () =>
      connections.find(
        (c) => c.platform === "linkedin" && c.canPublishLinkedIn,
      ) ?? null,
    [connections],
  );
  const activeDirectPublishConnection =
    platform === "facebook"
      ? fbConnection
      : platform === "linkedin"
        ? linkedinConnection
        : null;
  const canDirectPublish = activeDirectPublishConnection !== null;

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

  const onPublish = useCallback(async () => {
    if (!caption) return;
    if (platform !== "facebook" && platform !== "linkedin") return;
    const conn = activeDirectPublishConnection;
    if (!conn) return;
    hapticButtonPress();
    setPublishing(true);
    setPublishResult(null);
    const res = await publishMobileQuickPost({
      platform,
      connectionId: conn.id,
      caption,
      hashtags,
      trigger,
    });
    setPublishing(false);
    if (res.ok === false) {
      hapticError();
      setPublishResult({ ok: false, error: res.message });
      return;
    }
    hapticSuccess();
    setPublishResult({
      ok: true,
      externalPostUrl: res.externalPostUrl,
      platform: res.platform,
    });
  }, [caption, hashtags, platform, activeDirectPublishConnection, trigger]);

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
              {canDirectPublish && (
                <Pressable
                  onPress={onPublish}
                  disabled={publishing}
                  style={[
                    styles.actionButton,
                    platform === "linkedin"
                      ? styles.publishButtonLinkedIn
                      : styles.publishButton,
                    publishing && styles.actionButtonBusy,
                  ]}
                >
                  {publishing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.publishButtonText}>
                        Publish to {platform === "linkedin" ? "LinkedIn" : "Facebook"}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
              <Pressable onPress={onShare} style={styles.actionButton}>
                <Ionicons
                  name="share-outline"
                  size={16}
                  color={tokens.accent}
                />
                <Text style={styles.actionButtonText}>Share / Copy</Text>
              </Pressable>
            </View>

            {/* Publish result banner — success links to the live post,
                failure shows the error inline (reconnect flow lives on
                the connect-platforms screen). */}
            {publishResult?.ok === true ? (
              <View style={styles.successBanner}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={tokens.success}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successBannerTitle}>
                    Published to {labelFor(publishResult.platform)} ✓
                  </Text>
                  {publishResult.externalPostUrl && (
                    <Pressable
                      onPress={() =>
                        publishResult.externalPostUrl &&
                        Linking.openURL(publishResult.externalPostUrl)
                      }
                    >
                      <Text style={styles.successBannerLink}>
                        View the post →
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : publishResult?.ok === false ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={tokens.danger}
                />
                <Text style={styles.errorText}>{publishResult.error}</Text>
              </View>
            ) : null}

            <Text style={styles.helperText}>
              {platform === "facebook" && !canDirectPublish ? (
                <>
                  Want one-tap publish?{" "}
                  <Text
                    style={styles.linkText}
                    onPress={() => router.push("/connect-platforms" as never)}
                  >
                    Connect your Facebook Page
                  </Text>
                  .
                </>
              ) : platform === "linkedin" && !canDirectPublish ? (
                <>
                  Want one-tap publish?{" "}
                  <Text
                    style={styles.linkText}
                    onPress={() => router.push("/connect-platforms" as never)}
                  >
                    Connect LinkedIn
                  </Text>{" "}
                  and we&apos;ll post to your personal feed.
                </>
              ) : platform === "instagram" ? (
                <>
                  Instagram requires an image — use Share / Copy and post from
                  the IG app for now. Image upload on mobile is coming soon.
                </>
              ) : platform === "facebook" ? (
                <>
                  Posts go straight to your connected Facebook Page. Manage
                  connections from{" "}
                  <Text
                    style={styles.linkText}
                    onPress={() => router.push("/connect-platforms" as never)}
                  >
                    Connect Platforms
                  </Text>
                  .
                </>
              ) : platform === "linkedin" ? (
                <>
                  Posts go to your personal LinkedIn feed. Manage connections
                  from{" "}
                  <Text
                    style={styles.linkText}
                    onPress={() => router.push("/connect-platforms" as never)}
                  >
                    Connect Platforms
                  </Text>
                  .
                </>
              ) : (
                <>
                  Share / Copy into the {labelFor(platform)} app. Direct
                  publish for {labelFor(platform)} is coming soon.
                </>
              )}
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
    actionButtonBusy: { opacity: 0.7 },
    publishButton: {
      backgroundColor: "#1877F2", // Facebook blue
    },
    publishButtonLinkedIn: {
      backgroundColor: "#0A66C2", // LinkedIn blue
    },
    publishButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#fff",
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: tokens.accent,
    },
    successBanner: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 10,
      backgroundColor: tokens.successBg,
      borderWidth: 1,
      borderColor: tokens.successBorder,
    },
    successBannerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: tokens.successText,
    },
    successBannerLink: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: "600",
      color: tokens.successText,
      textDecorationLine: "underline",
    },
    linkText: {
      fontWeight: "700",
      color: tokens.accent,
      textDecorationLine: "underline",
    },
    helperText: {
      marginTop: 10,
      fontSize: 11,
      color: tokens.textSubtle,
      lineHeight: 16,
    },
  });
}
