import type {
  DailyAgendaItem,
  MobileDashboardPriorityAlert,
  MobileDashboardQuickAction,
  MobileDashboardStats,
} from "@leadsmart/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ErrorBanner } from "../../components/ErrorBanner";
import { DashboardStatCard } from "../../components/home/DashboardStatCard";
import { DailyAgendaList } from "../../components/home/DailyAgendaList";
import { PriorityAlertCard } from "../../components/home/PriorityAlertCard";
import { QuickActionRow } from "../../components/home/QuickActionRow";
import { ScreenLoading } from "../../components/ScreenLoading";
import {
  fetchMobileDailyAgenda,
  fetchMobileDashboard,
} from "../../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../../lib/leadsmartMobileApi";
import { theme } from "../../lib/theme";

function formatAgendaHeading(agendaDate: string): string {
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

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function HomeScreen() {
  const router = useRouter();
  const [initialDone, setInitialDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState<MobileApiFailure | null>(null);
  const [agendaError, setAgendaError] = useState<MobileApiFailure | null>(null);
  const [stats, setStats] = useState<MobileDashboardStats | null>(null);
  const [alerts, setAlerts] = useState<MobileDashboardPriorityAlert[]>([]);
  const [quickActions, setQuickActions] = useState<MobileDashboardQuickAction[]>([]);
  const [agendaDate, setAgendaDate] = useState("");
  const [agendaItems, setAgendaItems] = useState<DailyAgendaItem[]>([]);

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
        setQuickActions([]);
      }
    } else {
      setDashboardError(null);
      setStats(dash.stats);
      setAlerts(dash.priorityAlerts);
      setQuickActions(dash.quickActions);
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

  const handleQuickAction = useCallback(
    (key: string) => {
      switch (key) {
        case "add_task":
          router.push("/(tabs)/tasks");
          break;
        case "create_appointment":
          router.push({ pathname: "/(tabs)/calendar", params: { newAppt: "1" } });
          break;
        case "send_booking_link":
          router.push({ pathname: "/(tabs)/leads", params: { booking: "1" } });
          break;
        case "open_hot_leads":
          router.push({ pathname: "/(tabs)/leads", params: { filter: "hot" } });
          break;
        case "inbox":
          router.push("/(tabs)/inbox");
          break;
        case "leads":
          router.push("/(tabs)/leads");
          break;
        case "tasks":
          router.push("/(tabs)/tasks");
          break;
        case "calendar":
          router.push("/(tabs)/calendar");
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
        router.push("/(tabs)/tasks");
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
        router.push("/(tabs)/tasks");
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

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.heroTitle}>Today</Text>
        <Text style={styles.heroSub}>
          {agendaDate ? `${formatAgendaHeading(agendaDate)} · agenda in UTC` : "Your command center"}
        </Text>

        {dashboardError ? (
          <ErrorBanner
            title="Dashboard update failed"
            message={dashboardError.message}
            onRetry={() => void load("refresh")}
          />
        ) : null}

        <SectionTitle>Stats</SectionTitle>
        <View style={styles.statRow}>
          <DashboardStatCard
            label="Hot leads"
            value={stats.hotLeads}
            variant="hot"
            onPress={() => router.push({ pathname: "/(tabs)/leads", params: { filter: "hot" } })}
          />
          <DashboardStatCard
            label="Unread messages"
            value={stats.unreadMessages}
            onPress={() => router.push("/(tabs)/inbox")}
          />
        </View>
        <View style={styles.statRow}>
          <DashboardStatCard
            label="Tasks today"
            value={stats.tasksToday}
            onPress={() => router.push("/(tabs)/tasks")}
          />
          <DashboardStatCard
            label="Appointments today"
            value={stats.appointmentsToday}
            onPress={() => router.push("/(tabs)/calendar")}
          />
        </View>

        <SectionTitle>Quick actions</SectionTitle>
        {quickActions.length > 0 ? (
          <QuickActionRow actions={quickActions} onAction={handleQuickAction} />
        ) : (
          <Text style={styles.muted}>No quick actions from server.</Text>
        )}

        <SectionTitle>Priority alerts</SectionTitle>
        {alerts.length === 0 ? (
          <Text style={styles.muted}>No priority alerts — you’re caught up.</Text>
        ) : (
          alerts.map((a, i) => (
            <PriorityAlertCard
              key={`${a.type}-${a.leadId ?? "x"}-${a.createdAt ?? i}`}
              alert={a}
              onPress={() => handleAlertPress(a)}
            />
          ))
        )}

        <SectionTitle>Daily agenda</SectionTitle>
        {agendaError ? (
          <ErrorBanner
            title="Agenda unavailable"
            message={agendaError.message}
            onRetry={() => void load("refresh")}
          />
        ) : null}
        <DailyAgendaList items={agendaItems} onItemPress={handleAgendaItem} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  centered: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 16,
    paddingTop: 24,
    justifyContent: "flex-start",
  },
  heroTitle: { fontSize: 28, fontWeight: "800", color: theme.text },
  heroSub: { fontSize: 14, color: theme.textMuted, marginTop: 4, marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
  },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  muted: { fontSize: 14, color: theme.textMuted, paddingVertical: 6, lineHeight: 20 },
});
