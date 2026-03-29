import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  label: string;
  value: number;
  onPress?: () => void;
  variant?: "default" | "hot";
};

export function DashboardStatCard({ label, value, onPress, variant = "default" }: Props) {
  const inner = (
    <>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          variant === "hot" && styles.cardHot,
          pressed && styles.pressed,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={[styles.card, variant === "hot" && styles.cardHot]}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "42%",
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHot: {
    borderColor: theme.hotBorder,
    backgroundColor: theme.hotBg,
  },
  pressed: { opacity: 0.92 },
  value: { fontSize: 26, fontWeight: "800", color: theme.text },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: theme.textMuted,
    lineHeight: 16,
  },
});
