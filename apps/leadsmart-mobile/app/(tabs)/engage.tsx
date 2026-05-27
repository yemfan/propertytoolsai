import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useMemo } from "react";
import { HomeFeatureGrid } from "../../components/home/v2/HomeFeatureGrid";
import { HomeFeatureTile } from "../../components/home/v2/HomeFeatureTile";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

/**
 * Engage tab — mirrors the web `Engage` supercategory (Communicate +
 * Workflow). Surfaces outbound + scheduling features: conversations
 * (inbox), postcards, scheduled / recurring posts, post history.
 *
 * The (tabs)/inbox route still exists (hidden from the tab bar via
 * `href: null`) so deep links from push notifications + the Home
 * tab's alert cards still navigate correctly.
 */
export default function EngageTabScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation(["home", "nav"]);
  const accent = tokens.success;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("tabs.engage", { ns: "nav" })}</Text>
      <Text style={styles.subtitle}>{t("v2.tab_subtitle.engage", { ns: "home" })}</Text>

      <HomeFeatureGrid>
        <HomeFeatureTile
          icon={<Ionicons name="chatbubble-outline" size={24} color={accent} />}
          label={t("v2.tiles.inbox", { ns: "home" })}
          accentColor={accent}
          href="/(tabs)/inbox"
        />
        <HomeFeatureTile
          icon={<Ionicons name="mail-outline" size={24} color={accent} />}
          label={t("v2.tiles.postcards", { ns: "home" })}
          accentColor={accent}
          href="/postcards"
        />
        <HomeFeatureTile
          icon={<Ionicons name="time-outline" size={24} color={accent} />}
          label={t("v2.tiles.scheduled", { ns: "home" })}
          accentColor={accent}
          href="/scheduled"
        />
        <HomeFeatureTile
          icon={<Ionicons name="refresh-outline" size={24} color={accent} />}
          label={t("v2.tiles.recurring", { ns: "home" })}
          accentColor={accent}
          href="/recurring"
        />
        <HomeFeatureTile
          icon={<Ionicons name="archive-outline" size={24} color={accent} />}
          label={t("v2.tiles.post_history", { ns: "home" })}
          accentColor={accent}
          href="/post-history"
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
