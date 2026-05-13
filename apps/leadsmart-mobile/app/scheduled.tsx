import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  cancelMobileScheduledPost,
  fetchMobileScheduledPosts,
  type MobileScheduledPost,
} from "../lib/leadsmartMobileApi";
import {
  hapticButtonPress,
  hapticError,
  hapticSuccess,
} from "../lib/haptics";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

/**
 * Scheduled posts management screen on mobile. Three sections by
 * status: Upcoming (scheduled / posting / failed-with-retry),
 * Failed (terminal failures with last_error), Recent (posted +
 * cancelled). Pull-to-refresh + per-row Cancel for the Upcoming
 * section.
 *
 * Mirrors the structure of the web /dashboard/leads/generate/scheduled
 * page, simplified for the small screen — surfaces the most useful
 * fields (display name + caption preview + status badge + scheduled
 * time + last error if any).
 */
export default function ScheduledPostsScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [rows, setRows] = useState<MobileScheduledPost[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    const res = await fetchMobileScheduledPosts();
    if (mode === "refresh") setRefreshing(false);
    if (res.ok === false) {
      setError(res.message);
      setRows([]);
      return;
    }
    setRows(res.scheduled);
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const onCancel = useCallback(
    (row: MobileScheduledPost) => {
      Alert.alert(
        "Cancel scheduled post",
        `Cancel this ${labelFor(row.platform)} post scheduled for ${new Date(
          row.scheduledFor,
        ).toLocaleString()}? This cannot be undone.`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel post",
            style: "destructive",
            onPress: async () => {
              hapticButtonPress();
              setBusyId(row.id);
              const res = await cancelMobileScheduledPost(row.id);
              setBusyId(null);
              if (res.ok === false) {
                hapticError();
                Alert.alert("Cancel failed", res.message);
                return;
              }
              hapticSuccess();
              await load("refresh");
            },
          },
        ],
      );
    },
    [load],
  );

  if (rows === null) {
    return (
      <View style={styles.loadingBlock}>
        <Stack.Screen
          options={{ title: "Scheduled posts", headerBackTitle: "Home" }}
        />
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  const upcoming = rows.filter(
    (r) => r.status === "scheduled" || r.status === "posting",
  );
  const failed = rows.filter((r) => r.status === "failed");
  const recent = rows.filter(
    (r) => r.status === "posted" || r.status === "cancelled",
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load("refresh")}
          tintColor={tokens.accent}
        />
      }
    >
      <Stack.Screen
        options={{ title: "Scheduled posts", headerBackTitle: "Home" }}
      />

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={tokens.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {upcoming.length === 0 && failed.length === 0 && recent.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>Nothing scheduled yet</Text>
          <Text style={styles.emptyBody}>
            Open Quick Post → toggle Schedule → pick a time. Your scheduled
            drafts will show here.
          </Text>
        </View>
      ) : null}

      {upcoming.length > 0 && (
        <Section title="Upcoming" subtitle="Waiting for the publish cron.">
          {upcoming.map((r) => (
            <Card
              key={r.id}
              row={r}
              styles={styles}
              busy={busyId === r.id}
              onCancel={() => onCancel(r)}
            />
          ))}
        </Section>
      )}

      {failed.length > 0 && (
        <Section
          title="Failed"
          subtitle="Permanent errors. Reconnect or try a new post."
        >
          {failed.map((r) => (
            <Card key={r.id} row={r} styles={styles} busy={false} />
          ))}
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Recent" subtitle="Posted or cancelled.">
          {recent.slice(0, 30).map((r) => (
            <Card key={r.id} row={r} styles={styles} busy={false} />
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#6B7280",
          marginBottom: 4,
          marginTop: 8,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>
        {subtitle}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Card({
  row,
  styles,
  busy,
  onCancel,
}: {
  row: MobileScheduledPost;
  styles: ReturnType<typeof createStyles>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const when = new Date(row.scheduledFor).toLocaleString();
  const display =
    row.platform === "instagram"
      ? row.igBusinessUsername
        ? `@${row.igBusinessUsername}`
        : "Instagram"
      : row.platform === "facebook"
        ? row.pageName ?? "Facebook"
        : row.linkedinDisplayName ?? "LinkedIn";
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.platformBadge}>
            <Text style={styles.platformBadgeText}>
              {labelFor(row.platform)}
            </Text>
          </View>
          <Text style={styles.cardDisplay} numberOfLines={1}>
            {display}
          </Text>
        </View>
        <StatusBadge status={row.status} />
      </View>
      <Text style={styles.cardCaption} numberOfLines={3}>
        {row.caption}
      </Text>
      <Text style={styles.cardWhen}>
        {row.status === "posted"
          ? `Posted ${row.publishedAt ? new Date(row.publishedAt).toLocaleString() : when}`
          : row.status === "cancelled"
            ? `Was scheduled for ${when}`
            : `Scheduled for ${when}`}
      </Text>
      {row.lastError && (
        <Text style={styles.cardError} numberOfLines={3}>
          Error: {row.lastError}
        </Text>
      )}
      {(onCancel || row.publishedUrl) && (
        <View style={styles.cardActions}>
          {row.publishedUrl && (
            <Pressable
              onPress={() =>
                row.publishedUrl && Linking.openURL(row.publishedUrl)
              }
              style={styles.cardActionLink}
            >
              <Text style={styles.cardActionLinkText}>View the post →</Text>
            </Pressable>
          )}
          {onCancel && (
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={styles.cardCancelButton}
            >
              <Text style={styles.cardCancelText}>
                {busy ? "…" : "Cancel"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function labelFor(p: MobileScheduledPost["platform"]): string {
  if (p === "facebook") return "Facebook";
  if (p === "instagram") return "Instagram";
  return "LinkedIn";
}

function StatusBadge({ status }: { status: MobileScheduledPost["status"] }) {
  const color =
    status === "posted"
      ? "#059669"
      : status === "failed"
        ? "#DC2626"
        : status === "cancelled"
          ? "#6B7280"
          : status === "posting"
            ? "#D97706"
            : "#2563EB";
  const bg =
    status === "posted"
      ? "#D1FAE5"
      : status === "failed"
        ? "#FEE2E2"
        : status === "cancelled"
          ? "#F3F4F6"
          : status === "posting"
            ? "#FEF3C7"
            : "#DBEAFE";
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          color,
        }}
      >
        {status}
      </Text>
    </View>
  );
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 16, paddingBottom: 48 },
    loadingBlock: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.bg,
    },
    errorBox: {
      flexDirection: "row",
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: t.dangerBg,
      borderWidth: 1,
      borderColor: t.dangerBorder,
      marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 13, color: t.danger },
    emptyBlock: {
      padding: 24,
      borderRadius: 14,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderStyle: "dashed",
      alignItems: "center",
    },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    emptyBody: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      color: t.textSubtle,
    },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    platformBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.bg,
    },
    platformBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: t.textSubtle,
    },
    cardDisplay: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: t.text,
    },
    cardCaption: {
      fontSize: 13,
      lineHeight: 18,
      color: t.text,
    },
    cardWhen: {
      marginTop: 6,
      fontSize: 11,
      color: t.textSubtle,
    },
    cardError: {
      marginTop: 4,
      fontSize: 11,
      color: t.danger,
    },
    cardActions: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    cardActionLink: { paddingVertical: 4 },
    cardActionLinkText: {
      fontSize: 12,
      fontWeight: "700",
      color: t.accent,
    },
    cardCancelButton: {
      marginLeft: "auto",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.dangerBorder,
    },
    cardCancelText: {
      fontSize: 11,
      fontWeight: "700",
      color: t.danger,
    },
  });
}
