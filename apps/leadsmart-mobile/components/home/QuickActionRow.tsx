import type { MobileDashboardQuickAction } from "@leadsmart/shared";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  actions: MobileDashboardQuickAction[];
  onAction: (key: string) => void;
};

export function QuickActionRow({ actions, onAction }: Props) {
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

const styles = StyleSheet.create({
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
  chipPressed: { opacity: 0.9, backgroundColor: "#eff6ff" },
  chipText: { fontSize: 14, fontWeight: "700", color: theme.text },
});
