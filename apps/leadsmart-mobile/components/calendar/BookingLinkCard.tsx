import type { MobileBookingLinkDto } from "@leadsmart/shared";
import * as Linking from "expo-linking";
import { useMemo } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { formatShortDateTime } from "../../lib/format";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

type Props = {
  link: MobileBookingLinkDto;
  compact?: boolean;
};

export function BookingLinkCard({ link, compact }: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

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

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.successLight,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.successBorder,
      padding: 12,
      marginTop: 8,
    },
    cardCompact: { marginTop: 6, padding: 10 },
    label: { fontSize: 15, fontWeight: "700", color: theme.successText },
    labelMuted: { fontSize: 14, fontWeight: "600", color: theme.textMuted },
    url: { marginTop: 6, fontSize: 13, color: theme.successTextDark, lineHeight: 18 },
    created: { marginTop: 6, fontSize: 11, color: theme.textSubtle },
    row: { flexDirection: "row", gap: 10, marginTop: 12 },
    btn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.successButton,
    },
    btnOutline: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.successButton,
      backgroundColor: theme.surface,
    },
    btnPressed: { opacity: 0.9 },
    btnTextPrimary: { color: theme.textOnAccent, fontWeight: "700", fontSize: 14 },
    btnTextOutline: { color: theme.successTextDark, fontWeight: "700", fontSize: 14 },
  });
