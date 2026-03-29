import type { MobileBookingLinkDto } from "@leadsmart/shared";
import * as Linking from "expo-linking";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { formatShortDateTime } from "../../lib/format";
import { theme } from "../../lib/theme";

type Props = {
  link: MobileBookingLinkDto;
  compact?: boolean;
};

export function BookingLinkCard({ link, compact }: Props) {
  const open = () => {
    void Linking.openURL(link.booking_url);
  };

  const share = async () => {
    const msg = [link.share_message, link.label, link.booking_url].filter(Boolean).join("\n\n");
    await Share.share({ message: msg || link.booking_url, url: link.booking_url });
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {link.label ? (
        <Text style={styles.label} numberOfLines={2}>
          {link.label}
        </Text>
      ) : (
        <Text style={styles.labelMuted}>Booking link</Text>
      )}
      <Text style={styles.url} numberOfLines={2}>
        {link.booking_url}
      </Text>
      <Text style={styles.created}>Saved {formatShortDateTime(link.created_at)}</Text>
      <View style={styles.row}>
        <Pressable onPress={open} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
          <Text style={styles.btnTextPrimary}>Open</Text>
        </Pressable>
        <Pressable onPress={() => void share()} style={({ pressed }) => [styles.btnOutline, pressed && styles.btnPressed]}>
          <Text style={styles.btnTextOutline}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
    marginTop: 8,
  },
  cardCompact: { marginTop: 6, padding: 10 },
  label: { fontSize: 15, fontWeight: "700", color: "#14532d" },
  labelMuted: { fontSize: 14, fontWeight: "600", color: theme.textMuted },
  url: { marginTop: 6, fontSize: 13, color: "#166534", lineHeight: 18 },
  created: { marginTop: 6, fontSize: 11, color: theme.textSubtle },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#16a34a",
  },
  btnOutline: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#16a34a",
    backgroundColor: theme.surface,
  },
  btnPressed: { opacity: 0.9 },
  btnTextPrimary: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnTextOutline: { color: "#15803d", fontWeight: "700", fontSize: 14 },
});
