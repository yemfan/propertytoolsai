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
    // iOS HIG minimum tap target is 44x44pt. Earlier revision used
    // paddingVertical:10 which yielded ~34pt height — too small for
    // field agents using gloves or tapping on the move.
    minHeight: 44,
    minWidth: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  text: { fontSize: 13, fontWeight: "700", color: theme.accent },
});
