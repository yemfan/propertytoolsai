import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme } from "../../lib/theme";
import { AiReplyButton } from "./AiReplyButton";

export type ReplyComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAiDraft: () => void;
  sending: boolean;
  aiLoading: boolean;
  error: string | null;
  /** Brief “sent” acknowledgement */
  showSent?: boolean;
  placeholder?: string;
};

export function ReplyComposer({
  value,
  onChangeText,
  onSend,
  onAiDraft,
  sending,
  aiLoading,
  error,
  showSent,
  placeholder = "SMS reply…",
}: ReplyComposerProps) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>SMS reply</Text>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {showSent ? (
        <Text style={styles.success} accessibilityLiveRegion="polite">
          Message sent
        </Text>
      ) : null}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSubtle}
          multiline
          maxLength={1600}
          editable={!sending}
          accessibilityLabel="SMS reply text"
        />
        <AiReplyButton onPress={onAiDraft} loading={aiLoading} disabled={sending} />
      </View>
      <Pressable
        style={[styles.send, !canSend && styles.sendDisabled]}
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send SMS"
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.sendText}>Send SMS</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: theme.surface,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  error: { fontSize: 13, color: theme.errorTitle, marginBottom: 8 },
  success: { fontSize: 13, color: "#15803d", marginBottom: 8, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.bg,
  },
  send: {
    marginTop: 10,
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
