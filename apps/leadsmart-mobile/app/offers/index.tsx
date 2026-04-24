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
  fetchMobileOffers,
  type MobileOfferListItem,
  type MobileOfferStatus,
  type MobileOfferStatusFilter,
} from "../../lib/leadsmartMobileApi";
import { useCachedFetch } from "../../lib/offline/useCachedFetch";
import { hapticRowTap } from "../../lib/haptics";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

type FilterKey = "active" | "won" | "lost" | "all";
const FILTER_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: "active", label: "Active" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "all", label: "All" },
];

const STATUS_TONE: Record<MobileOfferStatus, "blue" | "green" | "red" | "gray" | "amber"> = {
  draft: "gray",
  submitted: "blue",
  countered: "amber",
  accepted: "green",
  rejected: "red",
  withdrawn: "red",
  expired: "gray",
};

const STATUS_LABEL: Record<MobileOfferStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  countered: "Countered",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

/**
 * Buyer-side offers list. Same useCachedFetch pattern as Showings
 * and Leads — instant from cache on next-open, revalidates in
 * background. Filter chips fall through to the API as a status
 * query param (`active` / `won` / `lost` / `all`) so the server
 * does the slicing; this matches the shape `listOffersForAgent`
 * already accepts and avoids re-implementing the bucket logic
 * client-side.
 */
export default function OffersListScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [filter, setFilter] = useState<FilterKey>("active");

  // Cache key includes the filter so each chip has its own cached
  // payload — flipping chips is instant from cache the second time
  // through, instead of refetching every chip-press.
  const cacheKey = `offers:list:${filter}`;
  const apiFilter: MobileOfferStatusFilter = filter;

  const { data, loading, error, stale, refresh } = useCachedFetch(
    cacheKey,
    () => fetchMobileOffers({ status: apiFilter }),
  );

  const offers = useMemo<MobileOfferListItem[]>(() => {
    if (!data || data.ok === false) return [];
    return data.offers;
  }, [data]);

  const onRowPress = useCallback(
    (id: string) => {
      hapticRowTap();
      router.push({ pathname: "/offers/[id]", params: { id } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MobileOfferListItem }) => (
      <OfferRow row={item} onPress={() => onRowPress(item.id)} />
    ),
    [onRowPress],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Offers",
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
          <ErrorBanner title="Could not load offers" message={error.message} onRetry={refresh} />
        </View>
      ) : null}

      {loading && offers.length === 0 ? (
        <SkeletonList count={6} renderItem={() => <LeadRowSkeleton />} />
      ) : offers.length === 0 ? (
        <EmptyState
          title={
            filter === "active"
              ? "No active offers"
              : filter === "won"
                ? "No accepted offers yet"
                : filter === "lost"
                  ? "No closed-out offers"
                  : "No offers yet"
          }
          subtitle={
            filter === "active"
              ? "Draft a new offer from a contact's detail page or after a showing."
              : "Try a different filter."
          }
        />
      ) : (
        <FadeIn>
          <FlatList
            data={offers}
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

const OfferRow = memo(function OfferRow({
  row,
  onPress,
}: {
  row: MobileOfferListItem;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const tone = STATUS_TONE[row.status];
  const price = formatMoney(row.current_price ?? row.offer_price);
  const list = row.list_price ? ` · list ${formatMoney(row.list_price)}` : "";
  const counters = row.counter_count > 0 ? `${row.counter_count} counter${row.counter_count > 1 ? "s" : ""}` : null;
  const buyer = row.contact_name ?? "Unknown buyer";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Offer on ${row.property_address} for ${buyer}, ${STATUS_LABEL[row.status]}, ${price}`}
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
          {price}
          {list}
          {` · ${buyer}`}
        </Text>
        {counters ? (
          <View style={styles.counterChip}>
            <Ionicons name="repeat" size={11} color={tokens.warning} />
            <Text style={styles.counterChipText}>{counters}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // Round to nearest dollar; offers are rarely fractional.
  return `$${Math.round(n).toLocaleString()}`;
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
    metaText: { flex: 1, fontSize: 13, color: t.textMuted, fontVariant: ["tabular-nums"] },
    counterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: t.warningBg,
    },
    counterChipText: { fontSize: 10, fontWeight: "600", color: t.warning },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    statusPill_blue: { backgroundColor: t.infoBg },
    statusPill_green: { backgroundColor: t.successBg },
    statusPill_red: { backgroundColor: t.dangerBg },
    statusPill_gray: { backgroundColor: t.surfaceMuted },
    statusPill_amber: { backgroundColor: t.warningBg },
    statusPillText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
    statusPillText_blue: { color: t.infoText },
    statusPillText_green: { color: t.successText },
    statusPillText_red: { color: t.dangerTitle },
    statusPillText_gray: { color: t.textMuted },
    statusPillText_amber: { color: t.warning },
  });
}
