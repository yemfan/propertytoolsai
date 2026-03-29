import type { DailyAgendaItem } from "@leadsmart/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../EmptyState";
import { formatShortDateTime } from "../../lib/format";
import { theme } from "../../lib/theme";

const TYPE_LABEL: Record<DailyAgendaItem["type"], string> = {
  task: "Task",
  appointment: "Appt",
  follow_up: "Follow-up",
};

type Props = {
  items: DailyAgendaItem[];
  onItemPress: (item: DailyAgendaItem) => void;
};

export function DailyAgendaList({ items, onItemPress }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Agenda clear"
        subtitle="No tasks, appointments, or follow-ups on this day."
      />
    );
  }

  return (
    <View>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onItemPress(item)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.pill}>
            <Text style={styles.pillText}>{TYPE_LABEL[item.type]}</Text>
          </View>
          <View style={styles.mid}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.sub} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
            <Text style={styles.time}>{formatShortDateTime(item.dueAt)}</Text>
          </View>
          <Text style={styles.chev} accessibilityLabel="Open">
            ›
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  pressed: { opacity: 0.92 },
  pill: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.textMuted,
    letterSpacing: 0.5,
  },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600", color: theme.text },
  sub: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  time: { fontSize: 12, color: theme.textSubtle, marginTop: 4 },
  chev: { fontSize: 20, color: theme.textSubtle },
});
