import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  fetchMobileRecurrences,
  updateMobileRecurrence,
  type MobileRecurrence,
} from "../lib/leadsmartMobileApi";
import {
  hapticButtonPress,
  hapticError,
  hapticSuccess,
} from "../lib/haptics";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

/**
 * Recurring posts management on mobile. Sections by status:
 * Active (pause / cancel), Paused (resume / cancel), Completed /
 * Cancelled (read-only). Pull-to-refresh.
 *
 * Mirrors the web /dashboard/leads/generate/recurring page, sized
 * for the small screen — single column, no inline edit (cancel +
 * recreate is the workflow).
 */

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RecurringScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [rows, setRows] = useState<MobileRecurrence[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    const res = await fetchMobileRecurrences();
    if (mode === "refresh") setRefreshing(false);
    if (res.ok === false) {
      setError(res.message);
      setRows([]);
      return;
    }
    setRows(res.recurrences);
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const act = useCallback(
    (row: MobileRecurrence, action: "pause" | "resume" | "cancel") => {
      const proceed = async () => {
        hapticButtonPress();
        setBusyId(row.id);
        const res = await updateMobileRecurrence(row.id, action);
        setBusyId(null);
        if (res.ok === false) {
          hapticError();
          Alert.alert(`${action} failed`, res.message);
          return;
        }
        hapticSuccess();
        await load("refresh");
      };
      if (action === "cancel") {
        Alert.alert(
          "Cancel recurrence",
          "Cancel this recurring post? This is permanent — agent will need to create a new recurrence to start over.",
          [
            { text: "Keep", style: "cancel" },
            { text: "Cancel", style: "destructive", onPress: () => void proceed() },
          ],
        );
      } else {
        void proceed();
      }
    },
    [load],
  );

  if (rows === null) {
    return (
      <View style={styles.loadingBlock}>
        <Stack.Screen
          options={{ title: "Recurring posts", headerBackTitle: "Home" }}
        />
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  const active = rows.filter((r) => r.status === "active");
  const paused = rows.filter((r) => r.status === "paused");
  const done = rows.filter(
    (r) => r.status === "completed" || r.status === "cancelled",
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
        options={{ title: "Recurring posts", headerBackTitle: "Home" }}
      />

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={tokens.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {active.length === 0 && paused.length === 0 && done.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>No recurring posts</Text>
          <Text style={styles.emptyBody}>
            Open Quick Post → toggle Recurring → pick a cadence. Your
            recurrences will live here.
          </Text>
        </View>
      ) : null}

      {active.length > 0 && (
        <Section title="Active" subtitle="Materializing on cadence.">
          {active.map((r) => (
            <Card
              key={r.id}
              row={r}
              styles={styles}
              busy={busyId === r.id}
              actions={[
                { label: "Pause", onPress: () => act(r, "pause") },
                {
                  label: "Cancel",
                  onPress: () => act(r, "cancel"),
                  destructive: true,
                },
              ]}
            />
          ))}
        </Section>
      )}

      {paused.length > 0 && (
        <Section title="Paused" subtitle="Cron is skipping these.">
          {paused.map((r) => (
            <Card
              key={r.id}
              row={r}
              styles={styles}
              busy={busyId === r.id}
              actions={[
                { label: "Resume", onPress: () => act(r, "resume") },
                {
                  label: "Cancel",
                  onPress: () => act(r, "cancel"),
                  destructive: true,
                },
              ]}
            />
          ))}
        </Section>
      )}

      {done.length > 0 && (
        <Section title="Done" subtitle="Completed or cancelled. Read-only.">
          {done.slice(0, 30).map((r) => (
            <Card key={r.id} row={r} styles={styles} busy={false} actions={[]} />
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
          marginTop: 8,
          marginBottom: 4,
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

function describeCadence(r: MobileRecurrence): string {
  const hh = String(r.timeOfDayHour).padStart(2, "0");
  const mm = String(r.timeOfDayMinute).padStart(2, "0");
  if (r.cadence === "daily") return `Every day at ${hh}:${mm} ${r.timezone}`;
  const day =
    r.weeklyDayOfWeek !== null
      ? WEEKDAY_LABEL[r.weeklyDayOfWeek]
      : "?";
  return `Every ${day} at ${hh}:${mm} ${r.timezone}`;
}

function Card({
  row,
  styles,
  busy,
  actions,
}: {
  row: MobileRecurrence;
  styles: ReturnType<typeof createStyles>;
  busy: boolean;
  actions: Array<{
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }>;
}) {
  const next = new Date(row.nextOccurrenceAt).toLocaleString();
  const ends = row.endsAt ? new Date(row.endsAt).toLocaleDateString() : null;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.platformBadge}>
            <Text style={styles.platformBadgeText}>
              {row.platform === "linkedin"
                ? "LinkedIn"
                : row.platform === "instagram"
                  ? "Instagram"
                  : "Facebook"}
            </Text>
          </View>
          {row.socialAccountDisplay && (
            <Text style={styles.cardDisplay} numberOfLines={1}>
              {row.socialAccountDisplay}
            </Text>
          )}
        </View>
        <StatusBadge status={row.status} />
      </View>
      <Text style={styles.cadence}>{describeCadence(row)}</Text>
      <Text style={styles.caption} numberOfLines={2}>
        {row.caption}
      </Text>
      <Text style={styles.cardWhen}>
        {row.status === "active"
          ? `Next: ${next}`
          : row.status === "paused"
            ? `Paused — next would have been ${next}`
            : `Posted ${row.occurrenceCount} time${row.occurrenceCount === 1 ? "" : "s"}`}
        {row.maxOccurrences ? ` · ${row.occurrenceCount}/${row.maxOccurrences}` : ""}
        {ends ? ` · ends ${ends}` : ""}
      </Text>
      {row.lastError && (
        <Text style={styles.cardError} numberOfLines={3}>
          Last error: {row.lastError}
        </Text>
      )}
      {actions.length > 0 && (
        <View style={styles.cardActions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              disabled={busy}
              style={[
                styles.cardActionButton,
                a.destructive && styles.cardCancelButton,
              ]}
            >
              <Text
                style={[
                  styles.cardActionText,
                  a.destructive && styles.cardCancelText,
                ]}
              >
                {busy ? "…" : a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: MobileRecurrence["status"] }) {
  const color =
    status === "active"
      ? "#059669"
      : status === "paused"
        ? "#D97706"
        : status === "completed"
          ? "#6B7280"
          : "#DC2626";
  const bg =
    status === "active"
      ? "#D1FAE5"
      : status === "paused"
        ? "#FEF3C7"
        : status === "completed"
          ? "#F3F4F6"
          : "#FEE2E2";
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
    cadence: {
      fontSize: 14,
      fontWeight: "700",
      color: t.text,
      marginBottom: 4,
    },
    caption: {
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
      gap: 8,
      justifyContent: "flex-end",
    },
    cardActionButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.border,
    },
    cardActionText: {
      fontSize: 11,
      fontWeight: "700",
      color: t.text,
    },
    cardCancelButton: {
      borderColor: t.dangerBorder,
    },
    cardCancelText: {
      color: t.danger,
    },
  });
}
