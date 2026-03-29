import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";

type Props = {
  message: string;
};

export function ScreenLoading({ message }: Props) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.bg,
  },
  text: { marginTop: 12, fontSize: 14, color: theme.textMuted },
});
