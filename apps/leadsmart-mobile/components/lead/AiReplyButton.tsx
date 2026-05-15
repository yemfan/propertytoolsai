import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { hapticButtonPress } from "../../lib/haptics";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

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
  label,
}: AiReplyButtonProps) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation("reply_composer");
  const resolvedLabel = label ?? t("ai_button.label_default");
  const off = Boolean(disabled || loading);
  return (
    <Pressable
      onPress={() => {
        // Medium "button press" tick — kicks off the AI draft request.
        // The downstream success/error notifications inside the modal
        // handle the terminal feedback.
        hapticButtonPress();
        onPress();
      }}
      disabled={off}
      style={[styles.btn, off && styles.btnDisabled]}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
      accessibilityState={{ disabled: off }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tokens.accent} />
      ) : (
        <Text style={styles.text}>{resolvedLabel}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
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
      backgroundColor: theme.accentPressed,
      alignItems: "center",
      justifyContent: "center",
    },
    btnDisabled: { opacity: 0.45 },
    text: { fontSize: 13, fontWeight: "700", color: theme.accent },
  });
