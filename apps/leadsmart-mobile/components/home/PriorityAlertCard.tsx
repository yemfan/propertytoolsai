import type { MobileDashboardPriorityAlert } from "@leadsmart/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

const CTA: Record<MobileDashboardPriorityAlert["type"], string> = {
  hot_lead: "Review",
  overdue_task: "Resolve",
  ai_escalation: "Handle",
  unread_message: "Reply",
};

type Props = {
  alert: MobileDashboardPriorityAlert;
  onPress: () => void;
};

export function PriorityAlertCard({ alert, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{CTA[alert.type]}</Text>
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={2}>
            {alert.title}
          </Text>
          {alert.subtitle ? (
            <Text style={styles.sub} numberOfLines={2}>
              {alert.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.chev} accessibilityLabel="Open">
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  pressed: { opacity: 0.92 },
  left: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  badge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.accent,
    textTransform: "uppercase",
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "700", color: theme.text },
  sub: { marginTop: 2, fontSize: 13, color: theme.textMuted, lineHeight: 18 },
  chev: { fontSize: 22, color: theme.textSubtle, paddingLeft: 4 },
});
