import { StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";

type Props = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingVertical: 32, alignItems: "center" },
  title: { fontSize: 15, fontWeight: "600", color: theme.textMuted, textAlign: "center" },
  sub: { marginTop: 8, fontSize: 13, color: theme.textSubtle, textAlign: "center", lineHeight: 18 },
});
