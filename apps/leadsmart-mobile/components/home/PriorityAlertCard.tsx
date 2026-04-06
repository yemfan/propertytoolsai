import type { MobileDashboardAlertType, MobileDashboardPriorityAlert } from "@leadsmart/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

const ALERT_EMOJI: Record<MobileDashboardAlertType, string> = {
  hot_lead: "🔥",
  overdue_task: "⏰",
  ai_escalation: "🤖",
  unread_message: "💬",
};

const ALERT_BG: Record<MobileDashboardAlertType, string> = {
  hot_lead: theme.hotBg,
  overdue_task: "#fefce8",
  ai_escalation: theme.accentLight,
  unread_message: theme.surface,
};

const ALERT_BORDER: Record<MobileDashboardAlertType, string> = {
  hot_lead: "#fed7aa",
  overdue_task: "#fef08a",
  ai_escalation: "#bae6fd",
  unread_message: theme.border,
};

type Props = {
  alert: MobileDashboardPriorityAlert;
  onPress: () => void;
};

export function PriorityAlertCard({ alert, onPress }: Props) {
  const emoji = ALERT_EMOJI[alert.type] ?? "•";
  const bg = ALERT_BG[alert.type] ?? theme.surface;
  const borderColor = ALERT_BORDER[alert.type] ?? theme.border;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: bg, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji} accessible={false}>
            {emoji}
          </Text>
        </View>
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
            <View style={styles.priorityRow}>
              <View style={styles.priorityDot} />
              <Text style={styles.priorityPill} numberOfLines={1}>
                High priority
                {alert.attentionScore != null ? ` · ${alert.attentionScore}` : ""}
              </Text>
            </View>
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  left: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 18, lineHeight: 22 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600", color: theme.text, lineHeight: 21 },
  sub: { marginTop: 4, fontSize: 13, color: theme.textMuted, lineHeight: 18 },
  priorityRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 5 },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ea580c",
  },
  priorityPill: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
    letterSpacing: 0.3,
  },
  reasonHint: { marginTop: 4, fontSize: 12, color: theme.textSubtle, lineHeight: 16 },
  chev: { fontSize: 22, color: theme.textSubtle, paddingLeft: 4 },
});
