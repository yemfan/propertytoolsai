import type { MobileAgentInboxNotificationDto, MobileNotificationDeepScreen } from "@leadsmart/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ErrorBanner } from "../components/ErrorBanner";
import { ScreenLoading } from "../components/ScreenLoading";
import { BrandRefreshControl } from "../components/BrandRefreshControl";
import {
  fetchMobileNotifications,
  postMobileNotificationRead,
} from "../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../lib/leadsmartMobileApi";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

function priorityLabel(p: MobileAgentInboxNotificationDto["priority"]): string {
  if (p === "high") return "High";
  if (p === "medium") return "Medium";
  return "Low";
}

function typeLabel(t: MobileAgentInboxNotificationDto["type"]): string {
  if (t === "hot_lead") return "Hot lead";
  if (t === "missed_call") return "Missed call";
  return "Reminder";
}

function navigateForDeepLink(
  router: ReturnType<typeof useRouter>,
  dl: MobileAgentInboxNotificationDto["data"]
) {
  const screen = dl?.deep_link?.screen as MobileNotificationDeepScreen | undefined;
  const leadId = dl?.deep_link?.lead_id;
  const taskId = dl?.deep_link?.task_id;

  if (screen === "task" && taskId) {
    router.push({ pathname: "/tasks", params: { focusTaskId: taskId } });
    return;
  }
  if (screen === "call_log" && leadId) {
    router.push({ pathname: "/lead/[id]", params: { id: leadId } });
    return;
  }
  if (leadId) {
    router.push({ pathname: "/lead/[id]", params: { id: leadId } });
  }
}

export default function NotificationsCenterScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [items, setItems] = useState<MobileAgentInboxNotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MobileApiFailure | null>(null);

  const load = useCallback(async (mode: "full" | "refresh") => {
    if (mode === "full") {
      setLoading(true);
      setError(null);
    }
    if (mode === "refresh") setRefreshing(true);

    const res = await fetchMobileNotifications({ limit: 40 });

    if (mode === "full") setLoading(false);
    if (mode === "refresh") setRefreshing(false);

    if (res.ok === false) {
      setError(res);
      setItems([]);
      return;
    }
    setItems(res.notifications);
    setError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("full");
    }, [load])
  );

  const onOpen = useCallback(
    async (n: MobileAgentInboxNotificationDto) => {
      if (!n.read) {
        const res = await postMobileNotificationRead({ notificationId: n.id });
        if (res.ok) {
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        }
      }
      navigateForDeepLink(router, n.data);
    },
    [router]
  );

  const onMarkAll = useCallback(async () => {
    const res = await postMobileNotificationRead({ markAllRead: true });
    if (res.ok) {
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    }
  }, []);

  if (loading) {
    return <ScreenLoading message="Loading notifications…" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarHint}>Recent alerts from your CRM</Text>
        <Pressable
          onPress={() => void onMarkAll()}
          style={({ pressed }) => [styles.markAll, pressed && styles.markAllPressed]}
          accessibilityRole="button"
          accessibilityLabel="Mark all as read"
        >
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      </View>

      {error ? (
        <ErrorBanner title="Could not load notifications" message={error.message} onRetry={() => void load("full")} />
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={<BrandRefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>You’re all caught up. Hot leads and reminders will show here.</Text>
        }
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => void onOpen(n)}
            style={({ pressed }) => [styles.card, !n.read && styles.cardUnread, pressed && styles.cardPressed]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.typeTag}>
                {typeLabel(n.type)} · {priorityLabel(n.priority)}
              </Text>
              <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.title}>{n.title}</Text>
            <Text style={styles.body} numberOfLines={3}>
              {n.body}
            </Text>
            <Text style={styles.cta}>Open</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  toolbarHint: { flex: 1, fontSize: 13, color: theme.textMuted, marginRight: 12 },
  markAll: { paddingVertical: 6, paddingHorizontal: 10 },
  markAllPressed: { opacity: 0.75 },
  markAllText: { fontSize: 14, fontWeight: "700", color: theme.accent },
  listContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  empty: { fontSize: 15, color: theme.textMuted, textAlign: "center", marginTop: 32, paddingHorizontal: 24 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 12,
  },
  /**
   * Unread card — tinted surface with an info-blue border to
   * pull attention. Uses `surfaceMuted` so the tint direction
   * is correct in both modes (slightly darker than `surface`
   * on light, slightly lifted from `bg` on dark).
   */
  cardUnread: { borderColor: theme.infoBorder, backgroundColor: theme.surfaceMuted },
  cardPressed: { opacity: 0.92 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  typeTag: { fontSize: 11, fontWeight: "800", color: theme.textSubtle, letterSpacing: 0.4 },
  time: { fontSize: 11, color: theme.textSubtle },
  title: { fontSize: 17, fontWeight: "700", color: theme.text, marginBottom: 6 },
  body: { fontSize: 15, color: theme.textMuted, lineHeight: 22 },
  cta: { marginTop: 10, fontSize: 14, fontWeight: "700", color: theme.accent },
});
