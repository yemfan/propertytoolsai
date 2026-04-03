import type { MobileDashboardAlertType, MobileDashboardPriorityAlert } from "@leadsmart/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

const ALERT_EMOJI: Record<MobileDashboardAlertType, string> = {
  hot_lead: "🔥",
  overdue_task: "⏰",
  ai_escalation: "🤖",
  unread_message: "💬",
};

type Props = {
  alert: MobileDashboardPriorityAlert;
  onPress: () => void;
};

export function PriorityAlertCard({ alert, onPress }: Props) {
  const emoji = ALERT_EMOJI[alert.type] ?? "•";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <Text style={styles.emoji} accessible={false}>
          {emoji}
        </Text>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={3}>
            {alert.title}
          </Text>
          {alert.subtitle ? (
            <Text style={styles.sub} numberOfLines={2}>
              {alert.subtitle}
            </Text>
          ) : null}
          {alert.attentionPriority === "high" ? (
            <Text style={styles.priorityPill} numberOfLines={1}>
              High priority
              {alert.attentionScore != null ? ` · ${alert.attentionScore}` : ""}
            </Text>
          ) : alert.attentionReasons && alert.attentionReasons.length > 0 ? (
            <Text style={styles.reasonHint} numberOfLines={1}>
              {alert.attentionReasons[0]}
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
  emoji: { fontSize: 20, lineHeight: 24, marginTop: 1 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600", color: theme.text, lineHeight: 21 },
  sub: { marginTop: 4, fontSize: 13, color: theme.textMuted, lineHeight: 18 },
  priorityPill: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
    letterSpacing: 0.3,
  },
  reasonHint: { marginTop: 4, fontSize: 12, color: theme.textSubtle, lineHeight: 16 },
  chev: { fontSize: 22, color: theme.textSubtle, paddingLeft: 4 },
});
