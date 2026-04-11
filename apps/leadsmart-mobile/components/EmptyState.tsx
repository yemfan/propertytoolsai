import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

type Props = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 24, paddingVertical: 32, alignItems: "center" },
    title: { fontSize: 15, fontWeight: "600", color: theme.textMuted, textAlign: "center" },
    sub: {
      marginTop: 8,
      fontSize: 13,
      color: theme.textSubtle,
      textAlign: "center",
      lineHeight: 18,
    },
  });
