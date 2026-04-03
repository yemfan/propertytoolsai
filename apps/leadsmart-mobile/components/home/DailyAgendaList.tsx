import type { DailyAgendaItem } from "@leadsmart/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../EmptyState";
import { formatAgendaClock } from "../../lib/format";
import { theme } from "../../lib/theme";

type Props = {
  items: DailyAgendaItem[];
  onItemPress: (item: DailyAgendaItem) => void;
};

export function DailyAgendaList({ items, onItemPress }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing scheduled"
        subtitle="No tasks, appointments, or follow-ups for this day."
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
          <Text style={styles.clock}>{formatAgendaClock(item.dueAt)}</Text>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.sub} numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
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
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  pressed: { opacity: 0.88 },
  clock: {
    width: 72,
    fontSize: 15,
    fontWeight: "700",
    color: theme.accent,
    paddingTop: 1,
  },
  body: { flex: 1, minWidth: 0, paddingRight: 8 },
  title: { fontSize: 16, fontWeight: "600", color: theme.text, lineHeight: 22 },
  sub: { fontSize: 14, color: theme.textMuted, marginTop: 2, lineHeight: 20 },
  chev: { fontSize: 20, color: theme.textSubtle, paddingTop: 2 },
});
