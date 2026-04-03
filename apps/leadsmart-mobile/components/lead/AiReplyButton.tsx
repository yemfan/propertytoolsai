import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../../lib/theme";

export type AiReplyButtonProps = {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
  label?: string;
};

export function AiReplyButton({
  onPress,
  loading,
  disabled,
  label = "AI draft",
}: AiReplyButtonProps) {
  const off = Boolean(disabled || loading);
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={[styles.btn, off && styles.btnDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: "#eff6ff",
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  text: { fontSize: 13, fontWeight: "700", color: theme.accent },
});
