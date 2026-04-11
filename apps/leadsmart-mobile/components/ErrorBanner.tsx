import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

type Props = {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorBanner({ title, message, onRetry, retryLabel = "Try again" }: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.msg}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    banner: {
      margin: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.dangerBg,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
    },
    title: { fontWeight: "700", color: theme.dangerTitle, marginBottom: 4 },
    msg: { fontSize: 13, color: theme.dangerBody },
    retry: {
      alignSelf: "flex-start",
      marginTop: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
    },
    retryPressed: { opacity: 0.85 },
    retryText: { fontSize: 14, fontWeight: "600", color: theme.dangerTitle },
  });
