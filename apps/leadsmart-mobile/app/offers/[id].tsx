import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BrandRefreshControl } from "../../components/BrandRefreshControl";
import { ErrorBanner } from "../../components/ErrorBanner";
import { FadeIn } from "../../components/Reveal";
import { ScreenLoading } from "../../components/ScreenLoading";
import {
  addMobileOfferCounter,
  convertMobileOfferToTransaction,
  fetchMobileOfferDetail,
  updateMobileOffer,
  type MobileApiFailure,
  type MobileCounterDirection,
  type MobileOfferCounterRow,
  type MobileOfferDetail,
  type MobileOfferRow,
  type MobileOfferStatus,
} from "../../lib/leadsmartMobileApi";
import { useCachedFetch } from "../../lib/offline/useCachedFetch";
import {
  hapticButtonPress,
  hapticError,
  hapticSelectionChange,
  hapticSuccess,
} from "../../lib/haptics";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

const STATUS_FLOW: Array<{ value: MobileOfferStatus; label: string; tone: "blue" | "green" | "red" | "gray" | "amber" }> = [
  { value: "draft", label: "Draft", tone: "gray" },
  { value: "submitted", label: "Submitted", tone: "blue" },
  { value: "countered", label: "Countered", tone: "amber" },
  { value: "accepted", label: "Accepted", tone: "green" },
  { value: "rejected", label: "Rejected", tone: "red" },
  { value: "withdrawn", label: "Withdrawn", tone: "red" },
  { value: "expired", label: "Expired", tone: "gray" },
];

/**
 * Offer detail. Built around the on-the-road agent who needs to:
 *
 *  1. Read the current price + contingency state at a glance.
 *  2. Flip status (Submitted → Countered, Submitted → Accepted, etc.)
 *     PATCHes immediately; service stamps submitted_at /
 *     accepted_at / closed_at.
 *  3. Log a counter the second the listing agent calls back —
 *     direction + price + notes via inline form.
 *  4. Convert an accepted offer into a transaction so the deal
 *     moves into the pipeline. Confirms first; the new transaction
 *     row is editable on web.
 *
 * Editing the underlying offer fields (address, financing, etc.)
 * stays on web for now — mobile gets the lifecycle moves and the
 * notes field, which is what gets touched in the field.
 */
export default function OfferDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const offerId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const fetcher = useCallback(async (): Promise<MobileOfferDetail | MobileApiFailure> => {
    if (!offerId) {
      return { ok: false, status: 0, message: "Missing offer id." };
    }
    const res = await fetchMobileOfferDetail(offerId);
    if (res.ok === false) return res;
    return {
      offer: res.offer,
      counters: res.counters,
      contactName: res.contactName,
    };
  }, [offerId]);

  const { data, loading, error, refresh } = useCachedFetch<MobileOfferDetail>(
    `offer:${offerId}`,
    fetcher,
    { enabled: Boolean(offerId) },
  );

  const [offer, setOffer] = useState<MobileOfferRow | null>(null);
  const [counters, setCounters] = useState<MobileOfferCounterRow[]>([]);
  const [contactName, setContactName] = useState<string | null>(null);

  const [statusBusy, setStatusBusy] = useState<MobileOfferStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null);

  const [counterDirection, setCounterDirection] = useState<MobileCounterDirection>(
    "seller_to_buyer",
  );
  const [counterPrice, setCounterPrice] = useState("");
  const [counterNotes, setCounterNotes] = useState("");
  const [counterSaving, setCounterSaving] = useState(false);
  const [counterError, setCounterError] = useState<string | null>(null);

  const [convertBusy, setConvertBusy] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setOffer(data.offer);
    setCounters(data.counters);
    setContactName(data.contactName);
    setNotes(data.offer.notes ?? "");
  }, [data]);

  const onPickStatus = useCallback(
    async (next: MobileOfferStatus) => {
      if (!offer || statusBusy || offer.status === next) return;
      hapticSelectionChange();
      setStatusError(null);
      setStatusBusy(next);
      const res = await updateMobileOffer(offer.id, { status: next });
      setStatusBusy(null);
      if (res.ok === false) {
        hapticError();
        setStatusError(res.message);
        return;
      }
      hapticSuccess();
      setOffer(res.offer);
    },
    [offer, statusBusy],
  );

  const onSaveNotes = useCallback(async () => {
    if (!offer) return;
    hapticButtonPress();
    setNotesError(null);
    setNotesSaving(true);
    const res = await updateMobileOffer(offer.id, { notes: notes.trim() });
    setNotesSaving(false);
    if (res.ok === false) {
      hapticError();
      setNotesError(res.message);
      return;
    }
    hapticSuccess();
    setOffer(res.offer);
    setNotesSavedAt(Date.now());
  }, [offer, notes]);

  const onLogCounter = useCallback(async () => {
    if (!offer) return;
    const priceParsed = counterPrice.trim() ? Number(counterPrice.replace(/[^0-9.]/g, "")) : null;
    if (counterPrice.trim() && (priceParsed === null || !Number.isFinite(priceParsed))) {
      setCounterError("Counter price must be a number.");
      return;
    }
    hapticButtonPress();
    setCounterError(null);
    setCounterSaving(true);
    const res = await addMobileOfferCounter(offer.id, {
      direction: counterDirection,
      price: priceParsed,
      notes: counterNotes.trim() || null,
    });
    setCounterSaving(false);
    if (res.ok === false) {
      hapticError();
      setCounterError(res.message);
      return;
    }
    hapticSuccess();
    // Append the new counter and re-fetch to pull updated parent
    // status/current_price (the service auto-flips status to
    // 'countered' and updates current_price when a price is given).
    setCounters((prev) => [...prev, res.counter]);
    setCounterPrice("");
    setCounterNotes("");
    refresh();
  }, [offer, counterDirection, counterPrice, counterNotes, refresh]);

  const onConvert = useCallback(async () => {
    if (!offer) return;
    Alert.alert(
      "Convert to transaction?",
      "This creates a buyer-rep transaction pre-filled from this offer. You can finish editing the transaction on the web.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert",
          style: "default",
          onPress: async () => {
            hapticButtonPress();
            setConvertError(null);
            setConvertBusy(true);
            const res = await convertMobileOfferToTransaction(offer.id);
            setConvertBusy(false);
            if (res.ok === false) {
              hapticError();
              setConvertError(res.message);
              return;
            }
            hapticSuccess();
            Alert.alert(
              "Transaction created",
              "The deal is now in your transactions list. Open it on the web to finish editing.",
            );
            // Pull fresh offer to surface the back-link (transaction_id).
            refresh();
          },
        },
      ],
    );
  }, [offer, refresh]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/offers");
  }, [router]);

  if (loading && !offer) {
    return <ScreenLoading message="Loading offer…" />;
  }

  if (error && !offer) {
    return (
      <View style={styles.errorWrap}>
        <Stack.Screen options={{ title: "Offer", headerBackTitle: "Back" }} />
        <ErrorBanner
          title="Could not load offer"
          message={error.message || "Unknown error"}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={styles.errorWrap}>
        <Stack.Screen options={{ title: "Offer", headerBackTitle: "Back" }} />
        <ErrorBanner
          title="Offer not found"
          message="This offer may have been deleted."
          onRetry={goBack}
          retryLabel="Back to list"
        />
      </View>
    );
  }

  const canConvert = offer.status === "accepted" && !offer.transaction_id;
  const alreadyConverted = offer.status === "accepted" && Boolean(offer.transaction_id);

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <Stack.Screen options={{ title: "Offer", headerBackTitle: "Back" }} />
      <FadeIn style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<BrandRefreshControl refreshing={loading} onRefresh={refresh} />}
        >
          {/* Property + price hero */}
          <View style={styles.hero}>
            <Text style={styles.address} numberOfLines={2}>
              {offer.property_address}
            </Text>
            {offer.city || offer.state || offer.zip ? (
              <Text style={styles.cityLine}>
                {[offer.city, offer.state, offer.zip].filter(Boolean).join(", ")}
              </Text>
            ) : null}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Current</Text>
              <Text style={styles.priceValue}>{formatMoney(offer.current_price ?? offer.offer_price)}</Text>
            </View>
            <View style={styles.priceRowSecondary}>
              <Text style={styles.priceLabelSecondary}>Initial offer</Text>
              <Text style={styles.priceValueSecondary}>{formatMoney(offer.offer_price)}</Text>
            </View>
            {offer.list_price ? (
              <View style={styles.priceRowSecondary}>
                <Text style={styles.priceLabelSecondary}>List price</Text>
                <Text style={styles.priceValueSecondary}>{formatMoney(offer.list_price)}</Text>
              </View>
            ) : null}
            {contactName ? (
              <Text style={styles.contactLine}>Buyer: {contactName}</Text>
            ) : null}
            {offer.mls_number ? (
              <Text style={styles.mlsLine}>MLS #{offer.mls_number}</Text>
            ) : null}
          </View>

          {/* Status picker */}
          <Text style={styles.sectionHeading}>Status</Text>
          <View style={styles.statusGrid}>
            {STATUS_FLOW.map((opt) => {
              const active = offer.status === opt.value;
              const busy = statusBusy === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => void onPickStatus(opt.value)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark as ${opt.label}`}
                  accessibilityState={{ selected: active, disabled: busy }}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    active && styles.statusBtnActive,
                    pressed && styles.statusBtnPressed,
                  ]}
                >
                  <Text style={[styles.statusBtnText, active && styles.statusBtnTextActive]}>
                    {busy ? "Saving…" : opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {statusError ? <Text style={styles.inlineError}>{statusError}</Text> : null}

          {/* Convert CTA — only shown for accepted offers */}
          {canConvert ? (
            <Pressable
              onPress={() => void onConvert()}
              disabled={convertBusy}
              accessibilityRole="button"
              accessibilityLabel="Convert to transaction"
              style={({ pressed }) => [
                styles.convertBtn,
                pressed && styles.convertBtnPressed,
                convertBusy && styles.convertBtnDisabled,
              ]}
            >
              <Ionicons name="trending-up" size={16} color={tokens.textOnAccent} />
              <Text style={styles.convertBtnText}>
                {convertBusy ? "Converting…" : "Convert to transaction"}
              </Text>
            </Pressable>
          ) : null}
          {alreadyConverted ? (
            <View style={styles.convertedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={tokens.successTextDark} />
              <Text style={styles.convertedBadgeText}>
                Converted to a transaction. Open the web app to finish editing.
              </Text>
            </View>
          ) : null}
          {convertError ? <Text style={styles.inlineError}>{convertError}</Text> : null}

          {/* Contingencies summary */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeading}>Contingencies</Text>
          <View style={styles.contingencyRow}>
            <ContingencyBadge label="Inspection" on={offer.inspection_contingency} styles={styles} tokens={tokens} />
            <ContingencyBadge label="Appraisal" on={offer.appraisal_contingency} styles={styles} tokens={tokens} />
            <ContingencyBadge label="Loan" on={offer.loan_contingency} styles={styles} tokens={tokens} />
          </View>
          {offer.contingency_notes ? (
            <Text style={styles.contingencyNotes}>{offer.contingency_notes}</Text>
          ) : null}

          {/* Counters log */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeading}>
            {counters.length === 0 ? "No counters yet" : `${counters.length} counter${counters.length > 1 ? "s" : ""}`}
          </Text>
          {counters.map((c) => (
            <View key={c.id} style={styles.counterCard}>
              <View style={styles.counterHeader}>
                <Text style={styles.counterRound}>Round #{c.counter_number}</Text>
                <Text style={styles.counterDirection}>
                  {c.direction === "seller_to_buyer" ? "Seller → Buyer" : "Buyer → Seller"}
                </Text>
              </View>
              {c.price != null ? (
                <Text style={styles.counterPrice}>{formatMoney(c.price)}</Text>
              ) : null}
              {c.notes ? <Text style={styles.counterNotes}>{c.notes}</Text> : null}
              <Text style={styles.counterDate}>{formatDate(c.created_at)}</Text>
            </View>
          ))}

          {/* Add counter form */}
          <Text style={styles.label}>Log a counter</Text>
          <View style={styles.directionRow}>
            {[
              { value: "seller_to_buyer" as const, label: "Seller → Buyer" },
              { value: "buyer_to_seller" as const, label: "Buyer → Seller" },
            ].map((opt) => {
              const active = counterDirection === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    hapticSelectionChange();
                    setCounterDirection(opt.value);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.directionBtn,
                    active && styles.directionBtnActive,
                    pressed && styles.directionBtnPressed,
                  ]}
                >
                  <Text style={[styles.directionText, active && styles.directionTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={counterPrice}
            onChangeText={setCounterPrice}
            placeholder="Counter price (optional)"
            placeholderTextColor={tokens.textSubtle}
            keyboardType="numeric"
            inputMode="numeric"
            style={styles.input}
          />
          <TextInput
            multiline
            value={counterNotes}
            onChangeText={setCounterNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={tokens.textSubtle}
            style={styles.textArea}
          />
          {counterError ? <Text style={styles.inlineError}>{counterError}</Text> : null}
          <Pressable
            onPress={() => void onLogCounter()}
            disabled={counterSaving}
            accessibilityRole="button"
            accessibilityLabel="Log counter"
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.secondaryBtnPressed,
              counterSaving && styles.secondaryBtnDisabled,
            ]}
          >
            <Text style={styles.secondaryBtnText}>
              {counterSaving ? "Saving…" : "Log counter"}
            </Text>
          </Pressable>

          {/* Notes */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeading}>Notes</Text>
          <TextInput
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth remembering — listing-agent quirks, deadlines, buyer concerns…"
            placeholderTextColor={tokens.textSubtle}
            style={styles.textArea}
          />
          {notesError ? <Text style={styles.inlineError}>{notesError}</Text> : null}
          {notesSavedAt && !notesError ? (
            <Text style={styles.inlineSaved}>Saved.</Text>
          ) : null}
          <Pressable
            onPress={() => void onSaveNotes()}
            disabled={notesSaving}
            accessibilityRole="button"
            accessibilityLabel="Save notes"
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.saveBtnPressed,
              notesSaving && styles.saveBtnDisabled,
            ]}
          >
            <Text style={styles.saveBtnText}>
              {notesSaving ? "Saving…" : "Save notes"}
            </Text>
          </Pressable>

          {/* Open buyer */}
          <Pressable
            onPress={() => {
              hapticButtonPress();
              router.push({ pathname: "/lead/[id]", params: { id: offer.contact_id } });
            }}
            accessibilityRole="button"
            accessibilityLabel="Open buyer detail"
            style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
          >
            <Ionicons name="person-outline" size={16} color={tokens.accent} />
            <Text style={styles.linkBtnText}>Open buyer</Text>
          </Pressable>
        </ScrollView>
      </FadeIn>
    </KeyboardAvoidingView>
  );
}

function ContingencyBadge({
  label,
  on,
  styles,
  tokens,
}: {
  label: string;
  on: boolean;
  styles: ReturnType<typeof createStyles>;
  tokens: ThemeTokens;
}) {
  return (
    <View style={[styles.contingencyBadge, on ? styles.contingencyOn : styles.contingencyOff]}>
      <Ionicons
        name={on ? "shield-checkmark" : "shield-outline"}
        size={12}
        color={on ? tokens.successTextDark : tokens.textMuted}
      />
      <Text style={[styles.contingencyText, on ? styles.contingencyTextOn : styles.contingencyTextOff]}>
        {label}
      </Text>
    </View>
  );
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    kav: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 16, paddingBottom: 48 },
    errorWrap: { flex: 1, backgroundColor: t.bg, padding: 16, justifyContent: "flex-start" },

    hero: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 16,
    },
    address: { fontSize: 18, fontWeight: "700", color: t.text },
    cityLine: { marginTop: 4, fontSize: 13, color: t.textMuted },
    priceRow: {
      marginTop: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    priceLabel: { fontSize: 13, fontWeight: "600", color: t.textMuted, textTransform: "uppercase", letterSpacing: 1 },
    priceValue: { fontSize: 22, fontWeight: "700", color: t.text, fontVariant: ["tabular-nums"] },
    priceRowSecondary: {
      marginTop: 4,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    priceLabelSecondary: { fontSize: 12, color: t.textMuted },
    priceValueSecondary: { fontSize: 13, color: t.textMuted, fontVariant: ["tabular-nums"] },
    contactLine: { marginTop: 10, fontSize: 13, color: t.textMuted },
    mlsLine: { marginTop: 4, fontSize: 12, color: t.textSubtle, fontVariant: ["tabular-nums"] },

    sectionHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },

    statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statusBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      minHeight: 40,
      justifyContent: "center",
    },
    statusBtnActive: { backgroundColor: t.chipActiveBg, borderColor: t.chipActiveBorder },
    statusBtnPressed: { opacity: 0.85 },
    statusBtnText: { fontSize: 13, fontWeight: "600", color: t.text },
    statusBtnTextActive: { color: t.chipActiveText },

    inlineError: { marginTop: 8, fontSize: 13, color: t.dangerTitle },
    inlineSaved: { marginTop: 8, fontSize: 13, color: t.successTextDark },

    convertBtn: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: t.successButton,
      minHeight: 48,
    },
    convertBtnPressed: { opacity: 0.85 },
    convertBtnDisabled: { opacity: 0.5 },
    convertBtnText: { fontSize: 15, fontWeight: "700", color: t.textOnAccent },
    convertedBadge: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: t.successBg,
      borderWidth: 1,
      borderColor: t.successBorder,
    },
    convertedBadgeText: { flex: 1, fontSize: 13, color: t.successTextDark, lineHeight: 18 },

    divider: { height: 1, backgroundColor: t.border, marginVertical: 24 },

    contingencyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    contingencyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    contingencyOn: { backgroundColor: t.successBg, borderColor: t.successBorder },
    contingencyOff: { backgroundColor: t.surfaceMuted, borderColor: t.border },
    contingencyText: { fontSize: 12, fontWeight: "600" },
    contingencyTextOn: { color: t.successTextDark },
    contingencyTextOff: { color: t.textMuted },
    contingencyNotes: { marginTop: 10, fontSize: 13, color: t.textMuted, lineHeight: 18 },

    counterCard: {
      backgroundColor: t.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 8,
    },
    counterHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    counterRound: { fontSize: 12, fontWeight: "700", color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
    counterDirection: { fontSize: 12, color: t.textMuted },
    counterPrice: { marginTop: 6, fontSize: 16, fontWeight: "700", color: t.text, fontVariant: ["tabular-nums"] },
    counterNotes: { marginTop: 4, fontSize: 13, color: t.textMuted, lineHeight: 18 },
    counterDate: { marginTop: 6, fontSize: 11, color: t.textSubtle },

    label: {
      marginTop: 12,
      marginBottom: 6,
      fontSize: 13,
      fontWeight: "600",
      color: t.text,
    },

    directionRow: { flexDirection: "row", gap: 8 },
    directionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: "center",
      minHeight: 40,
      justifyContent: "center",
    },
    directionBtnActive: { borderColor: t.accent, backgroundColor: t.accentPressed },
    directionBtnPressed: { opacity: 0.85 },
    directionText: { fontSize: 12, fontWeight: "600", color: t.text },
    directionTextActive: { color: t.accent },

    input: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      fontSize: 14,
      color: t.text,
      fontVariant: ["tabular-nums"],
    },

    textArea: {
      marginTop: 8,
      minHeight: 80,
      textAlignVertical: "top",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      padding: 12,
      fontSize: 14,
      color: t.text,
    },

    secondaryBtn: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    secondaryBtnPressed: { opacity: 0.85 },
    secondaryBtnDisabled: { opacity: 0.5 },
    secondaryBtnText: { fontSize: 14, fontWeight: "600", color: t.accent },

    saveBtn: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    saveBtnPressed: { opacity: 0.85 },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontSize: 15, fontWeight: "700", color: t.textOnAccent },

    linkBtn: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      minHeight: 44,
    },
    linkBtnPressed: { backgroundColor: t.surfaceMuted },
    linkBtnText: { fontSize: 13, fontWeight: "600", color: t.accent },
  });
}
