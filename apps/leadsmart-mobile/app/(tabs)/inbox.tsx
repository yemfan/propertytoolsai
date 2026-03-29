import type { MobileInboxThreadDto } from "@leadsmart/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ScreenLoading } from "../../components/ScreenLoading";
import { formatShortDateTime } from "../../lib/format";
import { getLeadsmartAccessToken } from "../../lib/env";
import { DEMO_LEAD_ID, getDemoInboxThread } from "../../lib/demoLead";
import { fetchMobileInbox, fetchMobileLeads } from "../../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../../lib/leadsmartMobileApi";
import { useInboxRealtime } from "../../lib/realtime/useInboxRealtime";
import { theme } from "../../lib/theme";

/** Hot threads first, then by recency (matches server ordering within each group). */
function sortInboxThreads(threads: MobileInboxThreadDto[]): MobileInboxThreadDto[] {
  return [...threads].sort((a, b) => {
    if (a.isHotLead !== b.isHotLead) return a.isHotLead ? -1 : 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

function ThreadRow({
  item,
  onPress,
}: {
  item: MobileInboxThreadDto;
  onPress: () => void;
}) {
  const channel = item.channel === "sms" ? "SMS" : "Email";
  const hot = item.isHotLead;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hot && styles.rowHot,
        pressed && styles.rowPressed,
      ]}
      accessibilityLabel={`${hot ? "Hot lead. " : ""}${channel} thread for ${item.leadName ?? item.leadId}`}
    >
      {hot ? (
        <View style={styles.hotStripe}>
          <Text style={styles.hotStripeText}>HOT LEAD</Text>
        </View>
      ) : null}
      <View style={styles.rowInner}>
        <View style={styles.rowTop}>
          <Text style={styles.channel}>{channel}</Text>
          {hot ? (
            <View style={styles.hotPill}>
              <Text style={styles.hotPillText}>Priority</Text>
            </View>
          ) : null}
          <Text style={styles.time}>{formatShortDateTime(item.lastMessageAt)}</Text>
        </View>
        <Text style={[styles.name, hot && styles.nameHot]} numberOfLines={1}>
          {item.leadName?.trim() || `Lead ${item.leadId}`}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {item.preview || "—"}
        </Text>
        <Text style={styles.meta}>
          {item.leadId === DEMO_LEAD_ID ? "Sample · " : ""}
          {item.lastDirection === "inbound" ? "Inbound" : "Outbound"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const [threads, setThreads] = useState<MobileInboxThreadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MobileApiFailure | null>(null);

  const load = useCallback(async (mode: "full" | "refresh" | "silent") => {
    if (mode === "full") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode !== "silent") setError(null);
    const res = await fetchMobileInbox();
    if (mode === "full") setLoading(false);
    if (mode === "refresh") setRefreshing(false);

    if (res.ok === false) {
      if (mode === "silent") return;
      setError(res);
      if (mode === "full") setThreads([]);
      return;
    }
    let next = sortInboxThreads(res.threads);
    if (next.length === 0 && mode !== "silent") {
      const lr = await fetchMobileLeads({ page: 1, pageSize: 1 });
      if (lr.ok && lr.total === 0) {
        next = [getDemoInboxThread()];
      }
    }
    setThreads(next);
  }, []);

  useEffect(() => {
    void load("full");
  }, [load]);

  const accessToken = getLeadsmartAccessToken();
  useInboxRealtime(
    useCallback(() => {
      void load("silent");
    }, [load]),
    Boolean(accessToken) && !loading
  );

  const onRefresh = useCallback(() => {
    void load("refresh");
  }, [load]);

  const listEmpty = useMemo(() => {
    if (error) return null;
    return (
      <EmptyState
        title="No conversations yet"
        subtitle="When leads text or email, their threads will show up here."
      />
    );
  }, [error]);

  if (loading && threads.length === 0) {
    return <ScreenLoading message="Loading inbox…" />;
  }

  return (
    <View style={styles.container}>
      {error ? (
        <ErrorBanner
          title="Could not load inbox"
          message={error.message}
          onRetry={() => {
            void load("full");
          }}
        />
      ) : null}
      <FlatList
        data={threads}
        keyExtractor={(t) => `${t.leadId}-${t.channel}-${t.messageId}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={listEmpty}
        renderItem={({ item }) => (
          <ThreadRow
            item={item}
            onPress={() =>
              router.push({
                pathname: "/lead/[id]",
                params: { id: item.leadId },
              })
            }
          />
        )}
        contentContainerStyle={threads.length === 0 ? styles.emptyList : styles.listPad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  listPad: { paddingVertical: 8 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  row: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: "hidden",
  },
  rowHot: {
    borderColor: theme.hotBorder,
    backgroundColor: theme.hotBg,
    borderLeftWidth: 4,
    borderLeftColor: theme.hotBorder,
  },
  rowPressed: { opacity: 0.92 },
  hotStripe: {
    backgroundColor: theme.hotBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hotStripeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  rowInner: { padding: 14 },
  rowTop: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  channel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hotPill: {
    backgroundColor: theme.hotPillBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.hotBorder,
  },
  hotPillText: { fontSize: 10, fontWeight: "800", color: theme.hotPillText },
  time: { marginLeft: "auto", fontSize: 11, color: theme.textSubtle },
  name: { fontSize: 16, fontWeight: "600", color: theme.text, marginBottom: 4 },
  nameHot: { color: theme.hotLabel },
  preview: { fontSize: 14, color: "#475569", lineHeight: 20 },
  meta: { marginTop: 8, fontSize: 11, color: theme.textSubtle },
});
