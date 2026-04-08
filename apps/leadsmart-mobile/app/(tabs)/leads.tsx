import type { MobileLeadRecordDto } from "@leadsmart/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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

type FilterKey = "all" | "hot" | "high_engagement" | "inactive";
const FILTER_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "hot", label: "Hot" },
  { key: "high_engagement", label: "Engaged" },
  { key: "inactive", label: "Inactive" },
];

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
  const stage = leadField(lead, "pipeline_stage_name") || leadField(lead, "lead_status");
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
        {stage ? (
          <View style={styles.stagePill}>
            <Text style={styles.stageText}>{stage}</Text>
          </View>
        ) : null}
        {lead.ai_lead_score != null ? (
          <Text style={styles.score}>AI {Math.round(lead.ai_lead_score)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function LeadsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string | string[]; booking?: string | string[] }>();
  const filterRaw = paramStr(params.filter);
  const initialFilter: FilterKey =
    filterRaw === "hot" ? "hot" : filterRaw === "inactive" ? "inactive" : "all";
  const showBookingHint = paramStr(params.booking) === "1";

  const [activeFilter, setActiveFilter] = useState<FilterKey>(initialFilter);
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<MobileLeadRecordDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MobileApiFailure | null>(null);

  const listFilter = activeFilter === "all" ? undefined : activeFilter;

  const loadPage = useCallback(
    async (nextPage: number, mode: "replace" | "append" | "refresh") => {
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
    },
    [listFilter]
  );

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

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const s = search.toLowerCase();
    return leads.filter((l) => {
      const name = leadField(l, "name").toLowerCase();
      const phone = (l.display_phone || leadField(l, "phone")).toLowerCase();
      const addr = leadField(l, "property_address").toLowerCase();
      return name.includes(s) || phone.includes(s) || addr.includes(s);
    });
  }, [leads, search]);

  const listEmpty = useMemo(() => {
    if (error) return null;
    if (search.trim()) {
      return <EmptyState title="No matches" subtitle="Try a different search term." />;
    }
    return <EmptyState title="No leads yet" subtitle="New leads from your funnels will appear here." />;
  }, [error, search]);

  if (loading && leads.length === 0) {
    return <ScreenLoading message="Loading leads..." />;
  }

  return (
    <View style={styles.container}>
      {error ? (
        <ErrorBanner
          title="Could not load leads"
          message={error.message}
          onRetry={() => void loadPage(1, "replace")}
        />
      ) : null}

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, address..."
          placeholderTextColor={theme.textSubtle}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.chipRow}>
        {FILTER_CHIPS.map((chip) => (
          <Pressable
            key={chip.key}
            onPress={() => setActiveFilter(chip.key)}
            style={[styles.chip, activeFilter === chip.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, activeFilter === chip.key && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
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
            {total > 0 ? (
              <Text style={styles.count}>
                {filtered.length === total
                  ? `${total} lead${total !== 1 ? "s" : ""}`
                  : `${filtered.length} of ${total} leads`}
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
        contentContainerStyle={filtered.length === 0 ? styles.emptyList : styles.listPad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  searchWrap: { paddingHorizontal: 12, paddingTop: 8 },
  searchInput: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.text,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: "#1e40af",
    borderColor: "#1e40af",
  },
  chipText: { fontSize: 12, fontWeight: "700", color: theme.text },
  chipTextActive: { color: "#fff" },
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
  listPad: { paddingVertical: 4 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  footerLoad: { paddingVertical: 16 },
  row: {
    marginHorizontal: 12,
    marginVertical: 5,
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
  address: { fontSize: 13, color: theme.textMuted, marginTop: 4, lineHeight: 18 },
  footer: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" },
  stagePill: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  stageText: { fontSize: 11, fontWeight: "600", color: "#1e40af" },
  score: { fontSize: 11, color: theme.accent, fontWeight: "600" },
});
