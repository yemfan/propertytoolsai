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
  showSent?: boolean;
  placeholder?: string;
  /** Hide the “SMS reply” label (lead detail wireframe). */
  hideLabel?: boolean;
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
  placeholder = "Type a reply…",
  hideLabel,
}: ReplyComposerProps) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={styles.wrap}>
      {!hideLabel ? <Text style={styles.label}>SMS reply</Text> : null}
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
      <View style={styles.composerRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSubtle}
          multiline
          maxLength={1600}
          editable={!sending}
          accessibilityLabel="Reply message"
        />
        <View style={styles.actions}>
          <AiReplyButton onPress={onAiDraft} loading={aiLoading} disabled={sending} label="AI" />
          <Pressable
            style={[styles.sendBtn, !canSend && styles.sendDisabled]}
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
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
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 2,
  },
  sendBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
