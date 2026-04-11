import type { MobileDashboardQuickAction } from "@leadsmart/shared";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

type Props = {
  actions: MobileDashboardQuickAction[];
  onAction: (key: string) => void;
};

export function QuickActionRow({ actions, onAction }: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {actions.map((a) => (
        <Pressable
          key={a.key}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={() => onAction(a.key)}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <Text style={styles.chipText}>{a.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    scroll: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    chip: {
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    chipPressed: { opacity: 0.9, backgroundColor: theme.accentPressed },
    chipText: { fontSize: 14, fontWeight: "700", color: theme.text },
  });
