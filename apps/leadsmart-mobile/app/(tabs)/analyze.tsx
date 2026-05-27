import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useMemo } from "react";
import { HomeFeatureSection } from "../../components/home/v2/HomeFeatureSection";
import { getHomeFeatureSection } from "../../lib/homeFeatures";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

/**
 * Analyze tab — mirrors the web `Analyze` supercategory (Insights +
 * Property Tools). Tile data sourced from `lib/homeFeatures.ts`.
 */
export default function AnalyzeTabScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation(["home", "nav"]);
  const section = getHomeFeatureSection("analyze");

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("tabs.analyze", { ns: "nav" })}</Text>
      <Text style={styles.subtitle}>{t("v2.tab_subtitle.analyze", { ns: "home" })}</Text>
      <HomeFeatureSection section={section} />
    </ScrollView>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 40 },
    h1: { fontSize: 28, fontWeight: "700", color: theme.text },
    subtitle: {
      marginTop: 6,
      marginBottom: 8,
      fontSize: 15,
      color: theme.textMuted,
    },
  });
