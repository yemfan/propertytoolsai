import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  createMobileOffer,
  type MobileFinancingType,
} from "../../lib/leadsmartMobileApi";
import { hapticButtonPress, hapticError, hapticSuccess } from "../../lib/haptics";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

const FINANCING_OPTIONS: Array<{ value: MobileFinancingType; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "conventional", label: "Conv." },
  { value: "fha", label: "FHA" },
  { value: "va", label: "VA" },
  { value: "jumbo", label: "Jumbo" },
  { value: "other", label: "Other" },
];

/**
 * New offer composer.
 *
 * Required from caller (query params):
 *   - `contactId` — the buyer the offer is for
 *
 * Optional pre-fill (query params):
 *   - `showingId` — back-link the offer to the showing it came from
 *   - `propertyAddress`, `city`, `state`, `zip`, `mlsNumber`,
 *     `listPrice` — common when launched from a Showing detail
 *
 * Defaults match the web composer: all three contingencies on,
 * status = draft (Submit-now toggle stamps it submitted).
 */
export default function NewOfferScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    contactId?: string;
    contactName?: string;
    showingId?: string;
    propertyAddress?: string;
    city?: string;
    state?: string;
    zip?: string;
    mlsNumber?: string;
    listPrice?: string;
  }>();

  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const contactId = pickString(params.contactId);
  const contactName = pickString(params.contactName);
  const showingId = pickString(params.showingId);

  const [propertyAddress, setPropertyAddress] = useState(pickString(params.propertyAddress) ?? "");
  const [city, setCity] = useState(pickString(params.city) ?? "");
  const [state, setState] = useState(pickString(params.state) ?? "");
  const [zip, setZip] = useState(pickString(params.zip) ?? "");
  const [mlsNumber, setMlsNumber] = useState(pickString(params.mlsNumber) ?? "");
  const [listPrice, setListPrice] = useState(pickString(params.listPrice) ?? "");
  const [offerPrice, setOfferPrice] = useState("");
  const [earnestMoney, setEarnestMoney] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [financingType, setFinancingType] = useState<MobileFinancingType | null>(null);
  const [closingDate, setClosingDate] = useState("");
  const [inspectionContingency, setInspectionContingency] = useState(true);
  const [appraisalContingency, setAppraisalContingency] = useState(true);
  const [loanContingency, setLoanContingency] = useState(true);
  const [contingencyNotes, setContingencyNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [submitNow, setSubmitNow] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = useCallback(async () => {
    if (!contactId) {
      setError("Missing contact id — open this screen from a contact or showing.");
      return;
    }
    if (!propertyAddress.trim()) {
      setError("Property address is required.");
      return;
    }
    const offerPriceNum = Number(offerPrice.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(offerPriceNum) || offerPriceNum <= 0) {
      setError("Offer price is required and must be a number.");
      return;
    }
    hapticButtonPress();
    setError(null);
    setSaving(true);
    const res = await createMobileOffer({
      contactId,
      propertyAddress: propertyAddress.trim(),
      offerPrice: offerPriceNum,
      showingId: showingId ?? null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
      mlsNumber: mlsNumber.trim() || null,
      listPrice: parseOptionalNumber(listPrice),
      earnestMoney: parseOptionalNumber(earnestMoney),
      downPayment: parseOptionalNumber(downPayment),
      financingType,
      closingDateProposed: closingDate.trim() || null,
      inspectionContingency,
      appraisalContingency,
      loanContingency,
      contingencyNotes: contingencyNotes.trim() || null,
      notes: notes.trim() || null,
      submitNow,
    });
    setSaving(false);
    if (res.ok === false) {
      hapticError();
      setError(res.message);
      return;
    }
    hapticSuccess();
    // Replace so back-button skips the composer and goes to the
    // list/showing the user came from.
    router.replace({ pathname: "/offers/[id]", params: { id: res.offer.id } });
  }, [
    contactId,
    propertyAddress,
    offerPrice,
    showingId,
    city,
    state,
    zip,
    mlsNumber,
    listPrice,
    earnestMoney,
    downPayment,
    financingType,
    closingDate,
    inspectionContingency,
    appraisalContingency,
    loanContingency,
    contingencyNotes,
    notes,
    submitNow,
    router,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <Stack.Screen options={{ title: "New offer", headerBackTitle: "Back" }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {contactName ? (
          <Text style={styles.subhead}>For {contactName}</Text>
        ) : null}

        <Text style={styles.label}>Property address *</Text>
        <TextInput
          value={propertyAddress}
          onChangeText={setPropertyAddress}
          placeholder="123 Main St"
          placeholderTextColor={tokens.textSubtle}
          style={styles.input}
        />
        <View style={styles.row3}>
          <View style={styles.flex2}>
            <Text style={styles.label}>City</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Austin"
              placeholderTextColor={tokens.textSubtle}
              style={styles.input}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>State</Text>
            <TextInput
              value={state}
              onChangeText={setState}
              placeholder="TX"
              placeholderTextColor={tokens.textSubtle}
              autoCapitalize="characters"
              maxLength={2}
              style={styles.input}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Zip</Text>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder="78701"
              placeholderTextColor={tokens.textSubtle}
              keyboardType="number-pad"
              maxLength={10}
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>MLS #</Text>
        <TextInput
          value={mlsNumber}
          onChangeText={setMlsNumber}
          placeholder="ABC123456"
          placeholderTextColor={tokens.textSubtle}
          style={styles.input}
        />

        <View style={styles.divider} />
        <Text style={styles.sectionHeading}>Offer terms</Text>

        <Text style={styles.label}>Offer price *</Text>
        <TextInput
          value={offerPrice}
          onChangeText={setOfferPrice}
          placeholder="$0"
          placeholderTextColor={tokens.textSubtle}
          keyboardType="numeric"
          inputMode="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>List price</Text>
        <TextInput
          value={listPrice}
          onChangeText={setListPrice}
          placeholder="$0"
          placeholderTextColor={tokens.textSubtle}
          keyboardType="numeric"
          inputMode="numeric"
          style={styles.input}
        />

        <View style={styles.row2}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Earnest money</Text>
            <TextInput
              value={earnestMoney}
              onChangeText={setEarnestMoney}
              placeholder="$0"
              placeholderTextColor={tokens.textSubtle}
              keyboardType="numeric"
              inputMode="numeric"
              style={styles.input}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Down payment</Text>
            <TextInput
              value={downPayment}
              onChangeText={setDownPayment}
              placeholder="$0"
              placeholderTextColor={tokens.textSubtle}
              keyboardType="numeric"
              inputMode="numeric"
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>Financing</Text>
        <View style={styles.financingRow}>
          {FINANCING_OPTIONS.map((opt) => {
            const active = financingType === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setFinancingType(active ? null : opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.financingBtn,
                  active && styles.financingBtnActive,
                  pressed && styles.financingBtnPressed,
                ]}
              >
                <Text
                  style={[
                    styles.financingText,
                    active && styles.financingTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Proposed closing date</Text>
        <TextInput
          value={closingDate}
          onChangeText={setClosingDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tokens.textSubtle}
          style={styles.input}
        />

        <View style={styles.divider} />
        <Text style={styles.sectionHeading}>Contingencies</Text>
        <ToggleRow
          label="Inspection"
          value={inspectionContingency}
          onChange={setInspectionContingency}
          styles={styles}
          tokens={tokens}
        />
        <ToggleRow
          label="Appraisal"
          value={appraisalContingency}
          onChange={setAppraisalContingency}
          styles={styles}
          tokens={tokens}
        />
        <ToggleRow
          label="Loan"
          value={loanContingency}
          onChange={setLoanContingency}
          styles={styles}
          tokens={tokens}
        />
        <Text style={styles.label}>Contingency notes</Text>
        <TextInput
          multiline
          value={contingencyNotes}
          onChangeText={setContingencyNotes}
          placeholder="Specifics on inspection period, appraisal gap, etc."
          placeholderTextColor={tokens.textSubtle}
          style={styles.textArea}
        />

        <View style={styles.divider} />
        <Text style={styles.label}>Notes</Text>
        <TextInput
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering for the next round."
          placeholderTextColor={tokens.textSubtle}
          style={styles.textArea}
        />

        <View style={styles.submitRow}>
          <View style={styles.submitCopy}>
            <Text style={styles.submitLabel}>Submit now</Text>
            <Text style={styles.submitHint}>
              Save as submitted (stamps submitted_at) — leave off to keep as draft.
            </Text>
          </View>
          <Switch
            value={submitNow}
            onValueChange={setSubmitNow}
            trackColor={{ false: tokens.border, true: tokens.accent }}
            thumbColor={tokens.surface}
          />
        </View>

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}

        <Pressable
          onPress={() => void onSave()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save offer"
          accessibilityState={{ disabled: saving }}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && styles.saveBtnPressed,
            saving && styles.saveBtnDisabled,
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : submitNow ? "Save & submit" : "Save draft"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  styles,
  tokens,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  styles: ReturnType<typeof createStyles>;
  tokens: ThemeTokens;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: tokens.border, true: tokens.accent }}
        thumbColor={tokens.surface}
      />
    </View>
  );
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function parseOptionalNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    kav: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 16, paddingBottom: 48 },

    subhead: { fontSize: 13, color: t.textMuted, marginBottom: 8 },
    sectionHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },
    label: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: "600", color: t.text },
    input: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      fontSize: 14,
      color: t.text,
    },
    textArea: {
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
    row2: { flexDirection: "row", gap: 8 },
    row3: { flexDirection: "row", gap: 8 },
    flex1: { flex: 1 },
    flex2: { flex: 2 },

    financingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    financingBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    financingBtnActive: { borderColor: t.accent, backgroundColor: t.accentPressed },
    financingBtnPressed: { opacity: 0.85 },
    financingText: { fontSize: 12, fontWeight: "600", color: t.text },
    financingTextActive: { color: t.accent },

    divider: { height: 1, backgroundColor: t.border, marginVertical: 24 },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    toggleLabel: { fontSize: 14, color: t.text },

    submitRow: {
      marginTop: 24,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    submitCopy: { flex: 1 },
    submitLabel: { fontSize: 14, fontWeight: "600", color: t.text },
    submitHint: { marginTop: 4, fontSize: 12, color: t.textMuted, lineHeight: 16 },

    inlineError: { marginTop: 12, fontSize: 13, color: t.dangerTitle },

    saveBtn: {
      marginTop: 16,
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
  });
}
