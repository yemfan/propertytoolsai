import type { MobileEmailMessageDto } from "@leadsmart/shared";
import { useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";
import { hapticError, hapticSuccess } from "../../lib/haptics";
import { AiReplyButton } from "./AiReplyButton";
import { AiActionGateBanner } from "../AiActionGateBanner";
import type { AiActionGate } from "../../lib/aiActionGate";

export function defaultEmailReplySubject(thread: MobileEmailMessageDto[]): string {
  const lastIn = [...thread].reverse().find((m) => m.direction === "inbound");
  const s = lastIn?.subject?.trim();
  if (!s) return "Message from your agent";
  return s.toLowerCase().startsWith("re:") ? s : `Re: ${s}`;
}

/**
 * AI draft result handed back from the parent's `onRequestAiDraft`.
 * Three terminal cases:
 *   - `ok: true`             — fill subject + body
 *   - `ok: false, gate`      — entitlement blocks AI; render the
 *                              shared upgrade banner inline
 *   - `ok: false, error`     — generic failure; show the red error string
 */
export type EmailAiDraftResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; gate: AiActionGate }
  | { ok: false; error: string };

export type EmailReplyModalProps = {
  visible: boolean;
  onClose: () => void;
  initialSubject: string;
  emailThread: MobileEmailMessageDto[];
  onSend: (subject: string, body: string) => Promise<void>;
  onRequestAiDraft: () => Promise<EmailAiDraftResult>;
};

export function EmailReplyModal({
  visible,
  onClose,
  initialSubject,
  emailThread,
  onSend,
  onRequestAiDraft,
}: EmailReplyModalProps) {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<AiActionGate | null>(null);

  useEffect(() => {
    if (visible) {
      setSubject(initialSubject);
      setBody("");
      setError(null);
      setGate(null);
    }
  }, [visible, initialSubject]);

  const onAi = async () => {
    setError(null);
    setGate(null);
    setAiLoading(true);
    try {
      const d = await onRequestAiDraft();
      if (d.ok) {
        setSubject(d.subject);
        setBody(d.body);
        return;
      }
      if ("gate" in d) {
        setGate(d.gate);
        return;
      }
      setError(d.error);
    } catch (e) {
      // Defensive: parent contract returns failure shapes, but a thrown
      // error (network blow-up before it can be caught upstream) still
      // shouldn't crash the modal.
      setError(e instanceof Error ? e.message : "AI draft failed");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    const sub = subject.trim();
    const txt = body.trim();
    if (!sub || !txt) {
      setError("Subject and body are required.");
      return;
    }
    setSending(true);
    try {
      await onSend(sub, txt);
      hapticSuccess();
      onClose();
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close modal" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Email reply</Text>
          {emailThread.length === 0 ? (
            <Text style={styles.hint}>No email thread yet — you can still send a first message.</Text>
          ) : null}
          {gate ? <AiActionGateBanner reason={gate.reason} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor={tokens.textSubtle}
            editable={!sending}
            accessibilityLabel="Email subject"
          />
          <View style={styles.aiRow}>
            <Text style={styles.fieldLabel}>Body</Text>
            <AiReplyButton onPress={() => void onAi()} loading={aiLoading} disabled={sending} />
          </View>
          <TextInput
            style={[styles.input, styles.bodyInput]}
            value={body}
            onChangeText={setBody}
            placeholder="Write your reply…"
            placeholderTextColor={tokens.textSubtle}
            multiline
            textAlignVertical="top"
            editable={!sending}
            accessibilityLabel="Email body"
          />
          <View style={styles.actions}>
            <Pressable
              style={styles.secondary}
              onPress={onClose}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primary, sending && styles.primaryDisabled]}
              onPress={() => void submit()}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Send email"
            >
              {sending ? (
                <ActivityIndicator color={tokens.textOnAccent} />
              ) : (
                <Text style={styles.primaryText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "92%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 8 },
  hint: { fontSize: 13, color: theme.textMuted, marginBottom: 8 },
  error: { fontSize: 13, color: theme.dangerTitle, marginBottom: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.bg,
  },
  bodyInput: { minHeight: 160, marginTop: 0 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  secondary: { paddingVertical: 12, paddingHorizontal: 16 },
  secondaryText: { fontSize: 16, fontWeight: "600", color: theme.textMuted },
  primary: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
    alignItems: "center",
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: theme.textOnAccent, fontSize: 16, fontWeight: "700" },
});
