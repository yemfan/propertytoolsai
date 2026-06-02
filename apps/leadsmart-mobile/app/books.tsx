import type {
  MobileInvoiceDto,
  MobileInvoicesResponseDto,
  MobileInvoiceStatus,
} from "@leadsmart/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchMobileInvoices, patchMobileInvoiceStatus } from "../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../lib/leadsmartMobileApi";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

type Styles = ReturnType<typeof createStyles>;

function money(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);
  } catch {
    return `$${(n || 0).toFixed(2)}`;
  }
}

export default function BooksScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [data, setData] = useState<MobileInvoicesResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MobileApiFailure | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: "full" | "refresh") => {
    if (mode === "full") {
      setLoading(true);
      setError(null);
    }
    if (mode === "refresh") setRefreshing(true);

    const res = await fetchMobileInvoices();

    if (mode === "full") setLoading(false);
    if (mode === "refresh") setRefreshing(false);

    if (res.ok === false) {
      setError(res);
      setData(null);
      return;
    }
    setData(res);
    setError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("full");
    }, [load]),
  );

  const changeStatus = useCallback(
    async (id: string, status: MobileInvoiceStatus) => {
      setBusyId(id);
      const res = await patchMobileInvoiceStatus(id, status);
      setBusyId(null);
      if (res.ok) void load("refresh");
    },
    [load],
  );

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tokens.accent} />
        <Text style={styles.muted}>Loading invoices…</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errTitle}>Couldn&apos;t load invoices</Text>
        <Text style={styles.muted}>{error.message}</Text>
        <Pressable style={styles.retry} onPress={() => void load("full")}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const d = data as MobileInvoicesResponseDto;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={tokens.accent} />
      }
    >
      <Text style={styles.h1}>Books</Text>
      <Text style={styles.subtitle}>Your invoices — what&apos;s outstanding and paid.</Text>

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: tokens.warningBg }]}>
          <Text style={styles.statLabel}>Outstanding</Text>
          <Text style={[styles.statValue, { color: tokens.warningText }]}>{money(d.outstanding)}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: tokens.successBg }]}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={[styles.statValue, { color: tokens.successText }]}>{money(d.paid)}</Text>
        </View>
      </View>

      {d.invoices.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.muted}>No invoices yet. Create one on the web dashboard.</Text>
        </View>
      ) : (
        d.invoices.map((inv) => (
          <InvoiceCard
            key={inv.id}
            inv={inv}
            tokens={tokens}
            styles={styles}
            busy={busyId === inv.id}
            onStatus={(s) => void changeStatus(inv.id, s)}
          />
        ))
      )}
    </ScrollView>
  );
}

function statusColors(status: MobileInvoiceStatus, t: ThemeTokens): { bg: string; fg: string } {
  switch (status) {
    case "paid":
      return { bg: t.successBg, fg: t.successText };
    case "overdue":
      return { bg: t.warningBg, fg: t.warningText };
    case "sent":
      return { bg: t.infoBg, fg: t.infoText };
    case "void":
      return { bg: t.dangerBg, fg: t.dangerText };
    default:
      return { bg: t.surfaceMuted, fg: t.textMuted };
  }
}

function InvoiceCard({
  inv,
  tokens,
  styles,
  busy,
  onStatus,
}: {
  inv: MobileInvoiceDto;
  tokens: ThemeTokens;
  styles: Styles;
  busy: boolean;
  onStatus: (status: MobileInvoiceStatus) => void;
}) {
  const sc = statusColors(inv.status, tokens);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.invNum}>{inv.invoice_number}</Text>
        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.badgeText, { color: sc.fg }]}>{inv.status}</Text>
        </View>
      </View>
      <Text style={styles.client} numberOfLines={1}>
        {inv.client_name || "—"}
        {inv.due_date ? `  ·  due ${inv.due_date}` : ""}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.amount}>{money(inv.total, inv.currency)}</Text>
        <View style={styles.actions}>
          {inv.status === "draft" ? (
            <Pressable style={styles.btn} disabled={busy} onPress={() => onStatus("sent")}>
              <Text style={styles.btnText}>Mark sent</Text>
            </Pressable>
          ) : null}
          {inv.status !== "paid" && inv.status !== "void" ? (
            <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={() => onStatus("paid")}>
              {busy ? (
                <ActivityIndicator size="small" color={tokens.textOnAccent} />
              ) : (
                <Text style={[styles.btnText, styles.btnPrimaryText]}>Mark paid</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.bg },
    h1: { fontSize: 28, fontWeight: "700", color: theme.text },
    subtitle: { marginTop: 6, marginBottom: 14, fontSize: 15, color: theme.textMuted },
    muted: { marginTop: 8, fontSize: 14, color: theme.textMuted, textAlign: "center" },
    errTitle: { fontSize: 16, fontWeight: "700", color: theme.text },
    retry: {
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: theme.accent,
    },
    retryText: { color: theme.textOnAccent, fontWeight: "600" },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    stat: { flex: 1, borderRadius: 14, padding: 12 },
    statLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, color: theme.textMuted },
    statValue: { marginTop: 4, fontSize: 18, fontWeight: "700" },
    empty: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 24,
      alignItems: "center",
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    invNum: { fontSize: 15, fontWeight: "700", color: theme.text },
    badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    client: { marginTop: 4, fontSize: 13, color: theme.textMuted },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
    amount: { fontSize: 18, fontWeight: "700", color: theme.text },
    actions: { flexDirection: "row", gap: 8 },
    btn: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 7,
      paddingHorizontal: 12,
      minWidth: 84,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: { fontSize: 13, fontWeight: "600", color: theme.text },
    btnPrimary: { backgroundColor: theme.success, borderColor: theme.success },
    btnPrimaryText: { color: theme.textOnAccent },
  });
