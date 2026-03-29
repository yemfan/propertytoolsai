import type { MobileLeadRecordDto } from "@leadsmart/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ScreenLoading } from "../../components/ScreenLoading";
import { leadField } from "../../lib/leadRecord";
import { DEMO_LEAD_ID, getDemoLeadRecord } from "../../lib/demoLead";
import { fetchMobileLeads } from "../../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../../lib/leadsmartMobileApi";
import { theme } from "../../lib/theme";

const PAGE_SIZE = 30;

function paramStr(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  const x = Array.isArray(v) ? v[0] : v;
  const s = String(x).trim();
  return s.length ? s : undefined;
}

function LeadRow({
  lead,
  onPress,
}: {
  lead: MobileLeadRecordDto;
  onPress: () => void;
}) {
  const name = leadField(lead, "name") || `Lead ${lead.id}`;
  const phone = lead.display_phone || leadField(lead, "phone") || leadField(lead, "phone_number");
  const address = leadField(lead, "property_address");
  const rating = leadField(lead, "rating");
  const status = leadField(lead, "lead_status");
  const hot = rating.toLowerCase() === "hot";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, hot && styles.rowHot, pressed && styles.rowPressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {hot ? (
          <View style={styles.hotPill}>
            <Text style={styles.hotText}>Hot</Text>
          </View>
        ) : null}
      </View>
      {phone ? <Text style={styles.sub}>{phone}</Text> : null}
      {address ? (
        <Text style={styles.address} numberOfLines={2}>
          {address}
        </Text>
      ) : null}
      <View style={styles.footer}>
        {status ? <Text style={styles.badge}>{status}</Text> : null}
        {lead.ai_lead_score != null ? (
          <Text style={styles.score}>AI score {Math.round(lead.ai_lead_score)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function LeadsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string | string[]; booking?: string | string[] }>();
  const filterRaw = paramStr(params.filter);
  const listFilter =
    filterRaw === "hot" ? "hot" : filterRaw === "inactive" ? "inactive" : undefined;
  const showBookingHint = paramStr(params.booking) === "1";

  const [leads, setLeads] = useState<MobileLeadRecordDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MobileApiFailure | null>(null);

  const loadPage = useCallback(async (nextPage: number, mode: "replace" | "append" | "refresh") => {
    if (nextPage === 1 && mode === "replace") setLoading(true);
    if (nextPage > 1) setLoadingMore(true);
    if (mode === "refresh") setRefreshing(true);

    const res = await fetchMobileLeads({
      page: nextPage,
      pageSize: PAGE_SIZE,
      filter: listFilter,
    });

    if (nextPage === 1 && mode === "replace") setLoading(false);
    if (nextPage > 1) setLoadingMore(false);
    if (mode === "refresh") setRefreshing(false);

    if (res.ok === false) {
      setError(res);
      if (mode === "replace" || mode === "refresh") setLeads([]);
      return;
    }

    setError(null);
    setTotal(res.total);
    let rows = res.leads;
    const allowDemoFallback =
      !listFilter && rows.length === 0 && res.total === 0 && (mode === "replace" || mode === "refresh");
    if (allowDemoFallback) {
      rows = [getDemoLeadRecord()];
    }
    if (mode === "append") {
      setLeads((prev) => [...prev, ...rows]);
    } else {
      setLeads(rows);
    }
    setPage(res.page);
  }, [listFilter]);

  useEffect(() => {
    void loadPage(1, "replace");
  }, [loadPage]);

  const onRefresh = useCallback(() => {
    void loadPage(1, "refresh");
  }, [loadPage]);

  const hasMore = leads.length < total;

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMore || error) return;
    void loadPage(page + 1, "append");
  }, [loadPage, loading, loadingMore, hasMore, page, error]);

  const listEmpty = useMemo(() => {
    if (error) return null;
    return <EmptyState title="No leads yet" subtitle="New leads from your funnels will appear here." />;
  }, [error]);

  if (loading && leads.length === 0) {
    return <ScreenLoading message="Loading leads…" />;
  }

  return (
    <View style={styles.container}>
      {error ? (
        <ErrorBanner
          title="Could not load leads"
          message={error.message}
          onRetry={() => {
            void loadPage(1, "replace");
          }}
        />
      ) : null}
      <FlatList
        data={leads}
        keyExtractor={(l) => String(l.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoad}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={
          <>
            {showBookingHint ? (
              <View style={styles.hintBanner}>
                <Text style={styles.hintText}>
                  Pick a lead below, open their profile, then use booking links or calendar tools to share
                  scheduling.
                </Text>
              </View>
            ) : null}
            {listFilter === "hot" ? (
              <Text style={styles.count}>Hot leads · {total} total</Text>
            ) : listFilter === "inactive" ? (
              <Text style={styles.count}>Inactive · {total} total</Text>
            ) : total > 0 ? (
              <Text style={styles.count}>
                {leads.length} of {total} leads
              </Text>
            ) : leads.length === 1 && String(leads[0].id) === DEMO_LEAD_ID ? (
              <Text style={styles.count}>Sample lead — add real leads in LeadSmart CRM</Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <LeadRow
            lead={item}
            onPress={() =>
              router.push({
                pathname: "/lead/[id]",
                params: { id: String(item.id) },
              })
            }
          />
        )}
        contentContainerStyle={leads.length === 0 ? styles.emptyList : styles.listPad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  hintBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  hintText: { fontSize: 13, color: "#1e3a8a", lineHeight: 18 },
  count: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 12, color: theme.textMuted },
  listPad: { paddingVertical: 8 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  footerLoad: { paddingVertical: 16 },
  row: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowHot: {
    borderColor: theme.hotBorder,
    backgroundColor: theme.hotBg,
    borderLeftWidth: 4,
    borderLeftColor: theme.hotBorder,
  },
  rowPressed: { opacity: 0.92 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.text },
  hotPill: {
    backgroundColor: theme.hotPillBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.hotBorder,
  },
  hotText: { fontSize: 10, fontWeight: "800", color: theme.hotPillText },
  sub: { fontSize: 14, color: "#475569", marginTop: 2 },
  address: { fontSize: 13, color: theme.textMuted, marginTop: 6, lineHeight: 18 },
  footer: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  score: { fontSize: 11, color: theme.accent, fontWeight: "600" },
});
