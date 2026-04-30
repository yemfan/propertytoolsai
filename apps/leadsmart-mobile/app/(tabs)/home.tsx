import type {
  DailyAgendaItem,
  MobileDashboardPriorityAlert,
  MobileDashboardStats,
} from "@leadsmart/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCachedFetch } from "../../lib/offline/useCachedFetch";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ErrorBanner } from "../../components/ErrorBanner";
import { BrandRefreshControl } from "../../components/BrandRefreshControl";
import { DailyAgendaList } from "../../components/home/DailyAgendaList";
import { PriorityAlertCard } from "../../components/home/PriorityAlertCard";
import { Skeleton } from "../../components/Skeleton";
import { FadeIn } from "../../components/Reveal";
import {
  fetchMobileDailyAgenda,
  fetchMobileDashboard,
  fetchLeadQueue,
} from "../../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../../lib/leadsmartMobileApi";
import { getSupabaseAuthClient } from "../../lib/supabaseAuthClient";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

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

function SectionRule({ color }: { color: string }) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: 16 }} />;
}

export default function HomeScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);

  // ── Cached fetches for dashboard + agenda ──────────────────────
  type DashboardPayload = {
    stats: MobileDashboardStats;
    priorityAlerts: MobileDashboardPriorityAlert[];
    weeklyDigest: {
      title: string;
      body: string;
      metrics: Record<string, number>;
      insights: Array<{ key: string; label: string; message: string; tone: string }>;
    } | null;
  };
  type AgendaPayload = { agendaDate: string; items: DailyAgendaItem[] };

  const dashFetcher = useCallback(async (): Promise<DashboardPayload | MobileApiFailure> => {
    const res = await fetchMobileDashboard();
    if (res.ok === false) return res;
    return {
      stats: res.stats,
      priorityAlerts: res.priorityAlerts,
      weeklyDigest: (res as any).weeklyDigest ?? null,
    };
  }, []);

  const agendaFetcher = useCallback(async (): Promise<AgendaPayload | MobileApiFailure> => {
    const res = await fetchMobileDailyAgenda();
    if (res.ok === false) return res;
    return { agendaDate: res.agendaDate, items: res.items };
  }, []);

  const {
    data: dashData,
    loading: dashLoading,
    error: dashboardError,
    refresh: dashRefresh,
  } = useCachedFetch<DashboardPayload>("home:dashboard", dashFetcher);

  const {
    data: agendaData,
    loading: agendaLoading,
    error: agendaError,
    refresh: agendaRefresh,
  } = useCachedFetch<AgendaPayload>("home:agenda", agendaFetcher);

  const stats = dashData?.stats ?? null;
  const alerts = dashData?.priorityAlerts ?? [];
  const weeklyDigest = dashData?.weeklyDigest ?? null;
  const agendaDate = agendaData?.agendaDate ?? "";
  const agendaItems = agendaData?.items ?? [];
  const initialDone = !dashLoading || dashData !== null;

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

  // Queue count stays as a focus-effect fetch (low-value for caching)
  useFocusEffect(
    useCallback(() => {
      void fetchLeadQueue().then((qRes) => {
        if (qRes.ok) setQueueCount(qRes.total);
      });
    }, [])
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    dashRefresh();
    agendaRefresh();
    // Clear refreshing flag after a short delay — the hooks manage
    // their own loading state, but the pull-to-refresh spinner
    // needs a boolean driven from here.
    setTimeout(() => setRefreshing(false), 600);
  }, [dashRefresh, agendaRefresh]);

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

  /*
   * First-load skeleton — mirrors the shape of the real home
   * screen (hero line + chip row + agenda list + two cards) so
   * the layout doesn't jump when the dashboard + agenda
   * responses arrive. Replaces the previous full-screen
   * `ScreenLoading` spinner, which made cold starts feel
   * longer than they actually were.
   */
  if (!initialDone) {
    return (
      <View style={styles.root}>
        <View style={styles.scrollContent}>
          <View style={styles.heroBlock}>
            <Skeleton width="70%" height={28} borderRadius={8} />
            <Skeleton
              width="85%"
              height={14}
              borderRadius={6}
              style={{ marginTop: 14 }}
            />
          </View>
          <SectionRule color={tokens.border} />
          <View style={styles.chipRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                width={88}
                height={36}
                borderRadius={999}
              />
            ))}
          </View>
          <SectionRule color={tokens.border} />
          <Skeleton width="30%" height={12} borderRadius={4} />
          <View style={{ marginTop: 12, gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <View
                key={i}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: tokens.surface,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                <Skeleton width="60%" height={14} borderRadius={4} />
                <Skeleton
                  width="90%"
                  height={12}
                  borderRadius={4}
                  style={{ marginTop: 8 }}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (dashboardError && !stats) {
    return (
      <View style={styles.centered}>
        <ErrorBanner
          title="Could not load home"
          message={dashboardError.message}
          onRetry={dashRefresh}
        />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centered}>
        <ErrorBanner title="Dashboard unavailable" message="Unexpected empty response." onRetry={dashRefresh} />
      </View>
    );
  }

  const displayName = firstName?.trim() || "there";
  const summaryLine = `${stats.hotLeads} hot leads • ${stats.tasksToday} tasks • ${stats.appointmentsToday} appointments`;

  return (
    <FadeIn style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<BrandRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.greeting}>
            {getGreeting()}, {displayName}
          </Text>
          <Text style={styles.summaryLine}>{summaryLine}</Text>
        </View>

        <SectionRule color={tokens.border} />

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
            onPress={() => router.push("/cma" as never)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>CMA</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/postcards" as never)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Postcards</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/showings" as never)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Showings</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>Alerts</Text>
          </Pressable>
        </View>

        <SectionRule color={tokens.border} />

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
            onRetry={agendaRefresh}
          />
        ) : null}
        <DailyAgendaList items={agendaItems} onItemPress={handleAgendaItem} />

        <SectionRule color={tokens.border} />

        <Text style={styles.sectionHeading}>Priority Alerts</Text>
        {dashboardError ? (
          <ErrorBanner
            title="Dashboard update failed"
            message={dashboardError.message}
            onRetry={dashRefresh}
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

        <SectionRule color={tokens.border} />

        {/* Weekly Digest */}
        {weeklyDigest && (
          <>
            <Text style={styles.sectionHeading}>{weeklyDigest.title}</Text>
            <View style={{ backgroundColor: tokens.surfaceMuted, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: tokens.textMuted, lineHeight: 20 }}>{weeklyDigest.body}</Text>
              {weeklyDigest.insights?.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {weeklyDigest.insights.slice(0, 3).map((ins) => (
                    <Text key={ins.key} style={{ fontSize: 12, color: ins.tone === "warning" ? tokens.warning : ins.tone === "positive" ? tokens.successDark : tokens.textMuted, marginTop: 4 }}>
                      {ins.label}: {ins.message}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            <SectionRule color={tokens.border} />
          </>
        )}

        {/* Lead Queue */}
        {queueCount > 0 && (
          <>
            <Pressable
              onPress={() => router.push("/(tabs)/leads" as any)}
              accessibilityRole="button"
              accessibilityLabel={`${queueCount} lead${queueCount > 1 ? "s" : ""} available to claim`}
              accessibilityHint="Opens the lead queue"
              style={({ pressed }) => [{
                backgroundColor: pressed ? tokens.accentPressed : tokens.infoBgAlt,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: tokens.infoBorder,
                marginBottom: 8,
                minHeight: 44, // WCAG 44pt touch target
              }]}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.infoText }}>
                {queueCount} lead{queueCount > 1 ? "s" : ""} available to claim
              </Text>
              <Text style={{ fontSize: 12, color: tokens.infoAccent, marginTop: 2 }}>
                Tap to view the lead queue
              </Text>
            </Pressable>
            <SectionRule color={tokens.border} />
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
    </FadeIn>
  );
}

/**
 * Style factory — consumed via `useMemo` in `HomeScreen` so the
 * stylesheet rebuilds when the OS color scheme flips.
 */
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
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
  chipPressed: { backgroundColor: theme.accentPressed, borderColor: theme.infoBorder },
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
  quickBtnPressed: { backgroundColor: theme.accentPressed, borderColor: theme.infoBorder },
  quickBtnText: { fontSize: 15, fontWeight: "700", color: theme.text },
});
