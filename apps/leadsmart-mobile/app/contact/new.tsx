import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  createMobileContact,
  type CreateMobileContactInput,
} from "../../lib/leadsmartMobileApi";
import { hapticButtonPress, hapticError, hapticSuccess } from "../../lib/haptics";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

/**
 * New-contact form. Mirrors the field set of the web `/dashboard/leads/add`
 * page (Name + Email + Phone + Address + Notes) and posts through the
 * shared intake pipeline via `/api/mobile/contacts/intake`.
 *
 * UX notes:
 *   - Every field has a *visible* label above the input. (Web's
 *     ContactsClient had placeholder-only labels that vanished when
 *     the user typed — see PR #463 for the parallel fix on the web
 *     side. Same lesson applied here pre-emptively.)
 *   - Validation errors from the server's zod schema land in
 *     `addErrors` keyed by field, rendered inline in red below the
 *     offending input.
 *   - HTTP 409 (duplicate match) flips a "Save anyway" inline action
 *     instead of opening a confirm dialog — keeps the flow on one
 *     screen so the agent can decide without losing the entered data.
 *   - Save dispatches haptic feedback (success on add, error on
 *     failure) to match the rest of the app.
 */
export default function NewContactScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation("leads");

  const [fields, setFields] = useState({
    name: "",
    email: "",
    phone: "",
    property_address: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [duplicateLeadId, setDuplicateLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = useCallback((key: keyof typeof fields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    // Clear that field's error as the user edits — small win that
    // prevents stale red borders after the obvious correction.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const submit = useCallback(
    async (forceCreate: boolean) => {
      hapticButtonPress();
      setSaving(true);
      setErrors({});
      setTopError(null);

      const payload: CreateMobileContactInput = {
        name: fields.name.trim() || null,
        email: fields.email.trim() || null,
        phone: fields.phone.trim() || null,
        property_address: fields.property_address.trim() || null,
        notes: fields.notes.trim() || null,
        forceCreate,
      };

      const res = await createMobileContact(payload);

      if (res.ok === false) {
        hapticError();
        setSaving(false);
        if (res.status === 400 && res.details) {
          setErrors(res.details);
          setTopError(t("add_contact.validation_failed"));
          return;
        }
        if (res.status === 409 && res.code === "DUPLICATE_CANDIDATE") {
          // Server returned a likely duplicate; surface inline so the
          // agent can confirm with the same data they already typed.
          setDuplicateLeadId(null);
          setTopError(t("add_contact.duplicate_warning"));
          return;
        }
        setTopError(res.message || t("add_contact.validation_failed"));
        return;
      }

      hapticSuccess();
      setSaving(false);
      Alert.alert(t("add_contact.success"));
      // Land on the lead detail screen so the agent can immediately
      // act on the new contact (call, message, schedule, etc.).
      router.replace({ pathname: "/lead/[id]", params: { id: res.leadId } });
    },
    [fields, router, t]
  );

  return (
    <>
      <Stack.Screen options={{ title: t("add_contact.header") }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {topError ? (
            <View style={styles.topErrorBox}>
              <Text style={styles.topErrorText}>{topError}</Text>
            </View>
          ) : null}

          <Field
            label={t("add_contact.name")}
            value={fields.name}
            onChangeText={(v) => setField("name", v)}
            errors={errors.name}
            tokens={tokens}
            autoCapitalize="words"
            autoComplete="name"
          />
          <Field
            label={t("add_contact.email")}
            value={fields.email}
            onChangeText={(v) => setField("email", v)}
            errors={errors.email}
            tokens={tokens}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label={t("add_contact.phone")}
            value={fields.phone}
            onChangeText={(v) => setField("phone", v)}
            errors={errors.phone}
            tokens={tokens}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Field
            label={t("add_contact.address")}
            value={fields.property_address}
            onChangeText={(v) => setField("property_address", v)}
            errors={errors.property_address}
            tokens={tokens}
            autoCapitalize="words"
            autoComplete="street-address"
          />
          <Field
            label={t("add_contact.notes")}
            value={fields.notes}
            onChangeText={(v) => setField("notes", v)}
            errors={errors.notes}
            tokens={tokens}
            multiline
          />

          {topError === t("add_contact.duplicate_warning") ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void submit(true)}
              disabled={saving}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.btnPressed,
                saving && styles.btnDisabled,
              ]}
            >
              <Text style={styles.secondaryBtnText}>{t("add_contact.force_create")}</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => void submit(false)}
            disabled={saving || (!fields.name.trim() && !fields.email.trim() && !fields.phone.trim())}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.btnPressed,
              (saving || (!fields.name.trim() && !fields.email.trim() && !fields.phone.trim())) && styles.btnDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={tokens.textOnAccent} />
            ) : (
              <Text style={styles.primaryBtnText}>{t("add_contact.submit")}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.cancelBtnText}>{t("add_contact.cancel")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  errors?: string[];
  tokens: ThemeTokens;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?:
    | "name"
    | "email"
    | "tel"
    | "street-address"
    | "off";
  keyboardType?: "default" | "email-address" | "phone-pad";
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  errors,
  tokens,
  autoCapitalize,
  autoComplete,
  keyboardType,
  multiline,
}: FieldProps) {
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const hasError = (errors?.length ?? 0) > 0;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          hasError ? styles.inputError : null,
        ]}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoComplete={autoComplete}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        placeholderTextColor={tokens.textSubtle}
      />
      {hasError ? (
        <Text style={styles.fieldError}>{errors!.join(" ")}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.bg },
    scrollContent: { padding: 16, paddingBottom: 48 },
    topErrorBox: {
      backgroundColor: theme.dangerBg,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    topErrorText: { color: theme.dangerText, fontSize: 13, lineHeight: 18 },
    field: { marginBottom: 14 },
    label: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textMuted,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      minHeight: 48,
    },
    inputMultiline: {
      minHeight: 96,
      textAlignVertical: "top",
      paddingTop: 12,
    },
    inputError: { borderColor: theme.dangerBorder },
    fieldError: {
      marginTop: 4,
      fontSize: 12,
      color: theme.dangerText,
    },
    primaryBtn: {
      marginTop: 16,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    primaryBtnText: {
      color: theme.textOnAccent,
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryBtn: {
      marginTop: 12,
      backgroundColor: theme.warningBg,
      borderWidth: 1,
      borderColor: theme.warningBorder,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    secondaryBtnText: {
      color: theme.warningText,
      fontSize: 14,
      fontWeight: "700",
    },
    cancelBtn: {
      marginTop: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    cancelBtnText: { color: theme.textMuted, fontSize: 14, fontWeight: "600" },
    btnPressed: { opacity: 0.7 },
    btnDisabled: { opacity: 0.5 },
  });
