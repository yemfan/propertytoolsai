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
  fetchLeadQueue,
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
  const [weeklyDigest, setWeeklyDigest] = useState<{
    title: string;
    body: string;
    metrics: Record<string, number>;
    insights: Array<{ key: string; label: string; message: string; tone: string }>;
  } | null>(null);
  const [queueCount, setQueueCount] = useState(0);

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
      setWeeklyDigest((dash as any).weeklyDigest ?? null);
    }

    // Best-effort queue count
    const qRes = await fetchLeadQueue();
    if (qRes.ok) setQueueCount(qRes.total);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.greeting}>
            {getGreeting()}, {displayName}
          </Text>
          <Text style={styles.summaryLine}>{summaryLine}</Text>
        </View>

        <SectionRule />

        <View style={styles.chipRow}>
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)/leads", params: { filter: "hot" } })}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Hot Leads</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/inbox")}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Unread</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/tasks")}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Tasks</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/calendar")}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Appointments</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Alerts</Text>
          </Pressable>
        </View>

        <SectionRule />

        <Text style={styles.sectionHeading}>Today</Text>
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
          <Text style={styles.muted}>No priority alerts — you&apos;re caught up.</Text>
        ) : (
          alerts.map((a, i) => (
            <PriorityAlertCard
              key={`${a.type}-${a.leadId ?? "x"}-${a.createdAt ?? i}`}
              alert={a}
              onPress={() => handleAlertPress(a)}
            />
          ))
        )}

        <SectionRule />

        {/* Weekly Digest */}
        {weeklyDigest && (
          <>
            <Text style={styles.sectionHeading}>{weeklyDigest.title}</Text>
            <View style={{ backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: theme.textMuted, lineHeight: 20 }}>{weeklyDigest.body}</Text>
              {weeklyDigest.insights?.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {weeklyDigest.insights.slice(0, 3).map((ins) => (
                    <Text key={ins.key} style={{ fontSize: 12, color: ins.tone === "warning" ? "#b45309" : ins.tone === "positive" ? "#15803d" : theme.textMuted, marginTop: 4 }}>
                      {ins.label}: {ins.message}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            <SectionRule />
          </>
        )}

        {/* Lead Queue */}
        {queueCount > 0 && (
          <>
            <Pressable
              onPress={() => router.push("/(tabs)/leads" as any)}
              style={({ pressed }) => [{
                backgroundColor: pressed ? "#eff6ff" : "#f0f9ff",
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: "#bfdbfe",
                marginBottom: 8,
              }]}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#1e40af" }}>
                {queueCount} lead{queueCount > 1 ? "s" : ""} available to claim
              </Text>
              <Text style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }}>
                Tap to view the lead queue
              </Text>
            </Pressable>
            <SectionRule />
          </>
        )}

        <Text style={styles.sectionHeading}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <Pressable
            onPress={() => handleFixedQuickAction("lead")}
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
          >
            <Text style={styles.quickBtnText}>+ Lead</Text>
          </Pressable>
          <Pressable
            onPress={() => handleFixedQuickAction("task")}
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
          >
            <Text style={styles.quickBtnText}>+ Task</Text>
          </Pressable>
          <Pressable
            onPress={() => handleFixedQuickAction("booking")}
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
          >
            <Text style={styles.quickBtnText}>+ Booking</Text>
          </Pressable>
          <Pressable
            onPress={() => handleFixedQuickAction("message")}
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
          >
            <Text style={styles.quickBtnText}>+ Message</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 36, paddingTop: 12 },
  centered: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 16,
    paddingTop: 24,
    justifyContent: "flex-start",
  },
  heroBlock: { paddingBottom: 4 },
  greeting: { fontSize: 26, fontWeight: "800", color: theme.text, letterSpacing: -0.3 },
  summaryLine: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "500",
    color: theme.textMuted,
    lineHeight: 22,
  },
  rule: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipPressed: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  chipText: { fontSize: 13, fontWeight: "700", color: theme.text },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  agendaHint: { fontSize: 12, color: theme.textSubtle, marginBottom: 10, marginTop: -4 },
  muted: { fontSize: 14, color: theme.textMuted, paddingVertical: 8, lineHeight: 20 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    marginTop: 4,
  },
  quickBtn: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
  },
  quickBtnPressed: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  quickBtnText: { fontSize: 15, fontWeight: "700", color: theme.text },
});
