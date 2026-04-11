import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { postMobileCalendarEvent } from "../../lib/leadsmartMobileApi";
import type { MobileCalendarEventDto } from "@leadsmart/shared";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

const OFFSETS: { label: string; h: number }[] = [
  { label: "1h", h: 1 },
  { label: "4h", h: 4 },
  { label: "24h", h: 24 },
  { label: "3d", h: 72 },
  { label: "1wk", h: 168 },
];

type Props = {
  visible: boolean;
  /** When set, lead id field is hidden. */
  leadIdFixed?: string | null;
  onClose: () => void;
  onCreated?: (event: MobileCalendarEventDto) => void;
};

export function AppointmentComposerModal({ visible, leadIdFixed, onClose, onCreated }: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [leadIdInput, setLeadIdInput] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [offsetHours, setOffsetHours] = useState(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setLeadIdInput("");
    setTitle("");
    setDescription("");
    setOffsetHours(24);
    setSubmitting(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [onClose, reset, submitting]);

  const submit = useCallback(async () => {
    const lid = (leadIdFixed ?? leadIdInput).trim();
    const t = title.trim();
    if (!lid) {
      setError("Lead ID is required.");
      return;
    }
    if (!t) {
      setError("Add a title.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await postMobileCalendarEvent({
      lead_id: lid,
      title: t,
      description: description.trim() || null,
      starts_at: hoursFromNow(offsetHours),
      calendar_provider: "local",
    });
    setSubmitting(false);
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    onCreated?.(res.event);
    reset();
    onClose();
  }, [leadIdFixed, leadIdInput, title, description, offsetHours, onCreated, onClose, reset]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Dismiss" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New appointment</Text>
            {!leadIdFixed ? (
              <TextInput
                style={styles.input}
                placeholder="Lead ID"
                placeholderTextColor={tokens.textSubtle}
                value={leadIdInput}
                onChangeText={setLeadIdInput}
                editable={!submitting}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Title (e.g. Showing · 123 Main St)"
              placeholderTextColor={tokens.textSubtle}
              value={title}
              onChangeText={setTitle}
              editable={!submitting}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Notes (optional)"
              placeholderTextColor={tokens.textSubtle}
              value={description}
              onChangeText={setDescription}
              multiline
              editable={!submitting}
            />
            <Text style={styles.label}>Starts in</Text>
            <View style={styles.chipRow}>
              {OFFSETS.map(({ label, h }) => (
                <Pressable
                  key={label}
                  onPress={() => setOffsetHours(h)}
                  disabled={submitting}
                  style={[styles.chip, offsetHours === h && styles.chipOn]}
                >
                  <Text style={[styles.chipText, offsetHours === h && styles.chipTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={handleClose} disabled={submitting} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void submit()} disabled={submitting} style={styles.saveBtn}>
                {submitting ? (
                  <ActivityIndicator color={tokens.textOnAccent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheetWrap: { maxHeight: "90%" },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    marginBottom: 10,
    backgroundColor: theme.bg,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipOn: { backgroundColor: theme.infoBg, borderColor: theme.accent },
  chipText: { fontSize: 13, fontWeight: "700", color: theme.textMuted },
  chipTextOn: { color: theme.accent },
  error: { color: theme.dangerTitle, marginTop: 8, fontSize: 14 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  cancelText: { fontSize: 16, fontWeight: "600", color: theme.textMuted },
  saveBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
    alignItems: "center",
  },
  saveText: { color: theme.textOnAccent, fontSize: 16, fontWeight: "700" },
});
