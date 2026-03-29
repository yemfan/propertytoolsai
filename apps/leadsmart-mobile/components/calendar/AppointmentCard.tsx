import type { MobileCalendarEventDto } from "@leadsmart/shared";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatShortDateTime } from "../../lib/format";
import { theme } from "../../lib/theme";

type Props = {
  event: MobileCalendarEventDto;
  variant?: "default" | "compact";
  onPress?: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
};

export function AppointmentCard({
  event,
  variant = "default",
  onPress,
  onCancel,
  cancelling,
}: Props) {
  const compact = variant === "compact";
  const prov = event.calendar_provider
    ? event.calendar_provider.charAt(0).toUpperCase() + event.calendar_provider.slice(1)
    : "Local";

  const inner = (
    <>
      <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 2 : 3}>
        {event.title}
      </Text>
      {event.lead_name && !compact ? (
        <Text style={styles.lead} numberOfLines={1}>
          {event.lead_name}
        </Text>
      ) : null}
      <Text style={styles.time}>{formatShortDateTime(event.starts_at)}</Text>
      <Text style={styles.meta}>
        {prov}
        {event.status !== "scheduled" ? ` · ${event.status}` : ""}
      </Text>
      {event.status === "scheduled" && onCancel ? (
        <Pressable
          onPress={onCancel}
          disabled={cancelling}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color={theme.errorTitle} />
          ) : (
            <Text style={styles.cancelText}>Cancel</Text>
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
        {inner}
      </Pressable>
    );
  }

  return <View style={[styles.card, compact && styles.cardCompact]}>{inner}</View>;
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
  title: { fontSize: 16, fontWeight: "600", color: theme.text, lineHeight: 22 },
  titleCompact: { fontSize: 15 },
  lead: { marginTop: 6, fontSize: 14, fontWeight: "600", color: theme.accent },
  time: { marginTop: 8, fontSize: 14, color: theme.text, fontWeight: "500" },
  meta: { marginTop: 4, fontSize: 12, color: theme.textMuted },
  cancelBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.errorBorder,
    backgroundColor: theme.errorBg,
  },
  cancelBtnPressed: { opacity: 0.88 },
  cancelText: { fontSize: 13, fontWeight: "700", color: theme.errorTitle },
});
