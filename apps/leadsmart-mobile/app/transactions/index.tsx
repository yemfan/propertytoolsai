import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BrandRefreshControl } from "../../components/BrandRefreshControl";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { FadeIn } from "../../components/Reveal";
import { LeadRowSkeleton, SkeletonList } from "../../components/Skeleton";
import {
  fetchMobileTransactions,
  type MobileTransactionListItem,
  type MobileTransactionStatus,
} from "../../lib/leadsmartMobileApi";
import { useCachedFetch } from "../../lib/offline/useCachedFetch";
import { hapticRowTap } from "../../lib/haptics";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

type FilterKey = "active" | "pending" | "closed" | "all";
const FILTER_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const STATUS_TONE: Record<MobileTransactionStatus, "blue" | "green" | "red" | "gray"> = {
  active: "blue",
  pending: "gray",
  closed: "green",
  terminated: "red",
};

const STATUS_LABEL: Record<MobileTransactionStatus, string> = {
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  terminated: "Terminated",
};

/**
 * Transactions list. Filter chips do client-side narrowing because
 * the dashboard service doesn't accept a status param — it always
 * returns all transactions for the agent. We slice locally so chip-
 * flip is instant. The cache key stays stable across chips so we
 * don't refetch on every chip change.
 */
export default function TransactionsListScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [filter, setFilter] = useState<FilterKey>("active");

  const { data, loading, error, stale, refresh } = useCachedFetch(
    "transactions:list",
    () => fetchMobileTransactions(),
  );

  const transactions = useMemo<MobileTransactionListItem[]>(() => {
    if (!data || data.ok === false) return [];
    return data.transactions;
  }, [data]);

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    if (filter === "active") return transactions.filter((t) => t.status === "active");
    if (filter === "pending") return transactions.filter((t) => t.status === "pending");
    // "closed" includes terminated so the agent can find a deal that
    // fell through without flipping to "all" — terminated is rare but
    // hiding it on the closed chip leaves users looking for it.
    return transactions.filter(
      (t) => t.status === "closed" || t.status === "terminated",
    );
  }, [transactions, filter]);

  const onRowPress = useCallback(
    (id: string) => {
      hapticRowTap();
      router.push({ pathname: "/transactions/[id]", params: { id } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MobileTransactionListItem }) => (
      <TransactionRow row={item} onPress={() => onRowPress(item.id)} />
    ),
    [onRowPress],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Transactions",
          headerBackTitle: "Back",
        }}
      />

      <View style={styles.filterStrip}>
        {FILTER_CHIPS.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setFilter(c.key)}
            style={[styles.chip, filter === c.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === c.key && styles.chipTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && data == null ? (
        <View style={styles.banner}>
          <ErrorBanner
            title="Could not load transactions"
            message={error.message}
            onRetry={refresh}
          />
        </View>
      ) : null}

      {loading && filtered.length === 0 ? (
        <SkeletonList count={6} renderItem={() => <LeadRowSkeleton />} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            filter === "active"
              ? "No active deals"
              : filter === "pending"
                ? "No pending deals"
                : filter === "closed"
                  ? "No closed deals yet"
                  : "No transactions yet"
          }
          subtitle={
            filter === "active"
              ? "Convert an accepted offer or create a transaction from a contact."
              : "Try a different filter."
          }
        />
      ) : (
        <FadeIn>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshControl={
              <BrandRefreshControl refreshing={loading && stale} onRefresh={refresh} />
            }
            contentContainerStyle={styles.listContent}
            removeClippedSubviews
          />
        </FadeIn>
      )}
    </View>
  );
}

const TransactionRow = memo(function TransactionRow({
  row,
  onPress,
}: {
  row: MobileTransactionListItem;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const tone = STATUS_TONE[row.status];
  const closingLine = formatClosing(row);
  const buyer = row.contact_name ?? "Unknown contact";
  const taskProgress = row.task_total > 0
    ? `${row.task_completed}/${row.task_total} tasks`
    : "No tasks";
  const overdue = row.task_overdue > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Transaction at ${row.property_address} for ${buyer}, ${STATUS_LABEL[row.status]}`}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.address} numberOfLines={1}>
          {row.property_address}
        </Text>
        <View style={[styles.statusPill, styles[`statusPill_${tone}`]]}>
          <Text style={[styles.statusPillText, styles[`statusPillText_${tone}`]]}>
            {STATUS_LABEL[row.status]}
          </Text>
        </View>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.metaText} numberOfLines={1}>
          {buyer}
          {closingLine ? ` · ${closingLine}` : ""}
        </Text>
        <View style={styles.taskRow}>
          {overdue ? (
            <View style={styles.overdueChip}>
              <Ionicons name="alert-circle" size={11} color={tokens.dangerTitle} />
              <Text style={styles.overdueChipText}>{row.task_overdue} overdue</Text>
            </View>
          ) : null}
          <Text style={styles.taskCount}>{taskProgress}</Text>
        </View>
      </View>
    </Pressable>
  );
});

function formatClosing(row: MobileTransactionListItem): string {
  if (row.closing_date_actual) {
    return `closed ${formatShortDate(row.closing_date_actual)}`;
  }
  if (row.closing_date) {
    return `closing ${formatShortDate(row.closing_date)}`;
  }
  return "";
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    filterStrip: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    chipActive: { backgroundColor: t.chipActiveBg, borderColor: t.chipActiveBorder },
    chipText: { fontSize: 13, fontWeight: "500", color: t.textMuted },
    chipTextActive: { color: t.chipActiveText },
    banner: { padding: 12 },
    listContent: { paddingVertical: 8 },
    row: {
      backgroundColor: t.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    rowPressed: { backgroundColor: t.surfaceMuted },
    rowHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    address: { flex: 1, fontSize: 15, fontWeight: "600", color: t.text },
    rowMeta: {
      marginTop: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    metaText: { flex: 1, fontSize: 13, color: t.textMuted },
    taskRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    overdueChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: t.dangerBg,
    },
    overdueChipText: { fontSize: 10, fontWeight: "600", color: t.dangerTitle },
    taskCount: { fontSize: 11, color: t.textSubtle, fontVariant: ["tabular-nums"] },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    statusPill_blue: { backgroundColor: t.infoBg },
    statusPill_green: { backgroundColor: t.successBg },
    statusPill_red: { backgroundColor: t.dangerBg },
    statusPill_gray: { backgroundColor: t.surfaceMuted },
    statusPillText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
    statusPillText_blue: { color: t.infoText },
    statusPillText_green: { color: t.successText },
    statusPillText_red: { color: t.dangerTitle },
    statusPillText_gray: { color: t.textMuted },
  });
}
