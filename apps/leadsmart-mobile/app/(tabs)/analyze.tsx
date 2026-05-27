import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useMemo } from "react";
import { HomeFeatureGrid } from "../../components/home/v2/HomeFeatureGrid";
import { HomeFeatureTile } from "../../components/home/v2/HomeFeatureTile";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

/**
 * Analyze tab — mirrors the web `Analyze` supercategory (Insights +
 * Property Tools). Surfaces the calculator + insight surfaces: CMA,
 * coaching, sphere monetization, daily briefings.
 */
export default function AnalyzeTabScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation(["home", "nav"]);
  const accent = tokens.warning;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("tabs.analyze", { ns: "nav" })}</Text>
      <Text style={styles.subtitle}>{t("v2.tab_subtitle.analyze", { ns: "home" })}</Text>

      <HomeFeatureGrid>
        <HomeFeatureTile
          icon={<Ionicons name="analytics-outline" size={24} color={accent} />}
          label={t("v2.tiles.cma", { ns: "home" })}
          accentColor={accent}
          href="/cma"
        />
        <HomeFeatureTile
          icon={<Ionicons name="people-outline" size={24} color={accent} />}
          label={t("v2.tiles.sphere", { ns: "home" })}
          accentColor={accent}
          href="/sphere"
        />
        <HomeFeatureTile
          icon={<Ionicons name="school-outline" size={24} color={accent} />}
          label={t("v2.tiles.coaching", { ns: "home" })}
          accentColor={accent}
          href="/coaching"
        />
        <HomeFeatureTile
          icon={<Ionicons name="newspaper-outline" size={24} color={accent} />}
          label={t("v2.tiles.briefings", { ns: "home" })}
          accentColor={accent}
          href="/briefings"
        />
      </HomeFeatureGrid>
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
      marginBottom: 20,
      fontSize: 15,
      color: theme.textMuted,
    },
  });
