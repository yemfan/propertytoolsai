import type {
  DailyAgendaItem,
  MobileDashboardPriorityAlert,
  MobileDashboardStats,
} from "@leadsmart/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ErrorBanner } from "../../components/ErrorBanner";
import { DailyAgendaList } from "../../components/home/DailyAgendaList";
import { PriorityAlertCard } from "../../components/home/PriorityAlertCard";
import { ScreenLoading } from "../../components/ScreenLoading";
import {
  fetchMobileDailyAgenda,
  fetchMobileDashboard,
} from "../../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../../lib/leadsmartMobileApi";
import { getSupabaseAuthClient } from "../../lib/supabaseAuthClient";
import { theme } from "../../lib/theme";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatAgendaDayLabel(agendaDate: string): string {
  try {
    const parts = agendaDate.split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return agendaDate;
    const [y, m, d] = parts;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return agendaDate;
  }
}

function SectionRule() {
  return <View style={styles.rule} />;
}

export default function HomeScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState<MobileApiFailure | null>(null);
  const [agendaError, setAgendaError] = useState<MobileApiFailure | null>(null);
  const [stats, setStats] = useState<MobileDashboardStats | null>(null);
  const [alerts, setAlerts] = useState<MobileDashboardPriorityAlert[]>([]);
  const [agendaDate, setAgendaDate] = useState("");
  const [agendaItems, setAgendaItems] = useState<DailyAgendaItem[]>([]);

  useEffect(() => {
    const sb = getSupabaseAuthClient();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user as { email?: string; user_metadata?: { full_name?: string } } | undefined;
      const meta = u?.user_metadata;
      const raw = meta?.full_name?.trim() || u?.email?.split("@")[0]?.trim() || "";
      const first = raw.split(/\s+/)[0];
      setFirstName(first || null);
    });
  }, []);

  const load = useCallback(async (mode: "full" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    if (mode === "full") {
      setDashboardError(null);
      setAgendaError(null);
    }

    const [dash, agenda] = await Promise.all([fetchMobileDashboard(), fetchMobileDailyAgenda()]);

    if (mode === "refresh") setRefreshing(false);
    setInitialDone(true);

    if (dash.ok === false) {
      setDashboardError(dash);
      if (mode === "full") {
        setStats(null);
        setAlerts([]);
      }
    } else {
      setDashboardError(null);
      setStats(dash.stats);
      setAlerts(dash.priorityAlerts);
    }

    if (agenda.ok === false) {
      setAgendaError(agenda);
    } else {
      setAgendaError(null);
      setAgendaDate(agenda.agendaDate);
      setAgendaItems(agenda.items);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("full");
    }, [load])
  );

  const onRefresh = useCallback(() => {
    void load("refresh");
  }, [load]);

  const handleFixedQuickAction = useCallback(
    (key: "lead" | "task" | "booking" | "message") => {
      switch (key) {
        case "lead":
          router.push("/(tabs)/leads");
          break;
        case "task":
          router.push("/tasks");
          break;
        case "booking":
          router.push({ pathname: "/(tabs)/calendar", params: { newAppt: "1" } });
          break;
        case "message":
          router.push("/(tabs)/inbox");
          break;
        default:
          break;
      }
    },
    [router]
  );

  const handleAlertPress = useCallback(
    (a: MobileDashboardPriorityAlert) => {
      if (a.leadId) {
        router.push({ pathname: "/lead/[id]", params: { id: String(a.leadId) } });
        return;
      }
      if (a.type === "unread_message") {
        router.push("/(tabs)/inbox");
        return;
      }
      if (a.type === "overdue_task") {
        router.push("/tasks");
        return;
      }
      router.push("/(tabs)/leads");
    },
    [router]
  );

  const handleAgendaItem = useCallback(
    (item: DailyAgendaItem) => {
      if (item.leadId) {
        router.push({ pathname: "/lead/[id]", params: { id: String(item.leadId) } });
        return;
      }
      if (item.type === "task") {
        router.push("/tasks");
        return;
      }
      if (item.type === "appointment") {
        router.push("/(tabs)/calendar");
        return;
      }
      router.push("/(tabs)/leads");
    },
    [router]
  );

  if (!initialDone) {
    return <ScreenLoading message="Loading your day…" />;
  }

  if (dashboardError && !stats) {
    return (
      <View style={styles.centered}>
        <ErrorBanner
          title="Could not load home"
          message={dashboardError.message}
          onRetry={() => void load("full")}
        />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centered}>
        <ErrorBanner title="Dashboard unavailable" message="Unexpected empty response." onRetry={() => void load("full")} />
      </View>
    );
  }

  const displayName = firstName?.trim() || "there";
  const summaryLine = `${stats.hotLeads} hot leads • ${stats.tasksToday} tasks • ${stats.appointmentsToday} appointments`;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        {/* Hero greeting */}
        <View style={styles.heroBlock}>
          <Text style={styles.greeting}>
            {getGreeting()}, {displayName}
          </Text>
          <Text style={styles.summaryLine}>{summaryLine}</Text>
        </View>

        {/* Stat cards — dashboard at a glance */}
        <View style={styles.statRow}>
          <View style={[styles.statCard, { borderLeftColor: theme.accent }]}>
            <Text style={styles.statValue}>{stats.hotLeads}</Text>
            <Text style={styles.statLabel}>🔥 Hot Leads</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: theme.success }]}>
            <Text style={styles.statValue}>{stats.tasksToday}</Text>
            <Text style={styles.statLabel}>✅ Tasks</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: theme.orange }]}>
            <Text style={styles.statValue}>{stats.appointmentsToday}</Text>
            <Text style={styles.statLabel}>📅 Appts</Text>
          </View>
        </View>

        {/* Quick actions — icon + label grid */}
        <View style={styles.quickGrid}>
          {[
            { key: "lead" as const, emoji: "👤", label: "Lead" },
            { key: "task" as const, emoji: "✏️", label: "Task" },
            { key: "booking" as const, emoji: "📅", label: "Booking" },
            { key: "message" as const, emoji: "💬", label: "Message" },
          ].map((action) => (
            <Pressable
              key={action.key}
              onPress={() => handleFixedQuickAction(action.key)}
              style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
            >
              <Text style={styles.quickBtnEmoji}>{action.emoji}</Text>
              <Text style={styles.quickBtnText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <SectionRule />

        {/* Filter chips */}
        <View style={styles.chipRow}>
          {[
            { label: "🔥 Hot", onPress: () => router.push({ pathname: "/(tabs)/leads", params: { filter: "hot" } }) },
            { label: "💬 Unread", onPress: () => router.push("/(tabs)/inbox") },
            { label: "⏰ Overdue", onPress: () => router.push("/tasks") },
            { label: "🔔 Alerts", onPress: () => router.push("/notifications") },
          ].map((chip) => (
            <Pressable
              key={chip.label}
              onPress={chip.onPress}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>

        <SectionRule />

        <Text style={styles.sectionHeading}>Today&apos;s Agenda</Text>
        {agendaDate ? (
          <Text style={styles.agendaHint}>
            {formatAgendaDayLabel(agendaDate)} · times in your local timezone
          </Text>
        ) : null}

        {agendaError ? (
          <ErrorBanner
            title="Agenda unavailable"
            message={agendaError.message}
            onRetry={() => void load("refresh")}
          />
        ) : null}
        <DailyAgendaList items={agendaItems} onItemPress={handleAgendaItem} />

        <SectionRule />

        <Text style={styles.sectionHeading}>Priority Alerts</Text>
        {dashboardError ? (
          <ErrorBanner
            title="Dashboard update failed"
            message={dashboardError.message}
            onRetry={() => void load("refresh")}
          />
        ) : null}
        {alerts.length === 0 ? (
          <View style={styles.emptyAlerts}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.muted}>All clear — you&apos;re caught up!</Text>
          </View>
        ) : (
          alerts.map((a, i) => (
            <PriorityAlertCard
              key={`${a.type}-${a.leadId ?? "x"}-${a.createdAt ?? i}`}
              alert={a}
              onPress={() => handleAlertPress(a)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 },
  centered: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 16,
    paddingTop: 24,
    justifyContent: "flex-start",
  },
  heroBlock: { paddingBottom: 16 },
  greeting: { fontSize: 28, fontWeight: "800", color: theme.text, letterSpacing: -0.5 },
  summaryLine: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "500",
    color: theme.textMuted,
    lineHeight: 20,
  },
  /* Stat cards */
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.textMuted,
    marginTop: 2,
  },
  /* Quick actions */
  quickGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: theme.surface,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickBtnPressed: {
    backgroundColor: theme.accentLight,
    transform: [{ scale: 0.97 }],
  },
  quickBtnEmoji: { fontSize: 22, marginBottom: 4 },
  quickBtnText: { fontSize: 11, fontWeight: "700", color: theme.textMuted },
  rule: {
    height: 1,
    backgroundColor: theme.borderSubtle,
    marginVertical: 16,
  },
  /* Chips */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipPressed: {
    backgroundColor: theme.accentLight,
    borderColor: theme.accent,
    transform: [{ scale: 0.97 }],
  },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.text },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  agendaHint: { fontSize: 12, color: theme.textSubtle, marginBottom: 10, marginTop: -4 },
  muted: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  emptyAlerts: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyEmoji: { fontSize: 28, marginBottom: 8 },
});
