import type { MobileLeadTaskDto } from "@leadsmart/shared";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatTaskDueLabel } from "../../lib/format";
import { theme } from "../../lib/theme";

const priorityStyle: Record<string, { bg: string; fg: string }> = {
  low: { bg: "#f1f5f9", fg: "#64748b" },
  medium: { bg: "#e0f2fe", fg: "#0369a1" },
  high: { bg: "#ffedd5", fg: "#9a3412" },
  urgent: { bg: "#fee2e2", fg: "#b91c1c" },
};

type Props = {
  task: MobileLeadTaskDto;
  variant?: "default" | "compact";
  showLeadName?: boolean;
  onPress?: () => void;
  onComplete?: () => void;
  completing?: boolean;
};

export function TaskCard({
  task,
  variant = "default",
  showLeadName = true,
  onPress,
  onComplete,
  completing,
}: Props) {
  const open = task.status === "open";
  const pri = priorityStyle[task.priority] ?? priorityStyle.medium;
  const compact = variant === "compact";

  const body = (
    <>
      <View style={styles.topRow}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 2 : 3}>
          {task.title}
        </Text>
        <View style={[styles.priorityPill, { backgroundColor: pri.bg }]}>
          <Text style={[styles.priorityText, { color: pri.fg }]}>{task.priority}</Text>
        </View>
      </View>
      {showLeadName && task.lead_name ? (
        <Text style={styles.leadName} numberOfLines={1}>
          {task.lead_name}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.due}>{formatTaskDueLabel(task.due_at)}</Text>
        {task.task_type ? <Text style={styles.typeHint}>{task.task_type}</Text> : null}
      </View>
      {open && onComplete ? (
        <Pressable
          onPress={onComplete}
          disabled={completing}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
        >
          {completing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.doneBtnText}>Done</Text>
          )}
        </Pressable>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          compact && styles.cardCompact,
          pressed && styles.cardPressed,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={[styles.card, compact && styles.cardCompact]}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginVertical: 6,
  },
  cardCompact: { padding: 12, marginVertical: 0 },
  cardPressed: { opacity: 0.92 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.text, lineHeight: 22 },
  titleCompact: { fontSize: 15 },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  leadName: { marginTop: 6, fontSize: 13, color: theme.accent, fontWeight: "600" },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  due: { fontSize: 13, color: theme.textMuted, fontWeight: "500" },
  typeHint: { fontSize: 12, color: theme.textSubtle },
  doneBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 88,
    alignItems: "center",
  },
  doneBtnPressed: { opacity: 0.9 },
  doneBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
