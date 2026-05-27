import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { HomeFeatureGrid } from "../../components/home/v2/HomeFeatureGrid";
import { HomeFeatureTile } from "../../components/home/v2/HomeFeatureTile";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

/**
 * Work tab — mirrors the web `Work` supercategory from
 * `nav.config.tsx`. Surfaces the daily prospecting + ops features:
 * leads, tasks, calendar, showings, quick post (= web's "Generate
 * Leads"). See `docs/HOME_REDESIGN_PLAN.md` for the full mapping.
 *
 * The (tabs)/leads + (tabs)/calendar routes still exist (the screens
 * weren't moved) — they're hidden from the tab bar via `href: null`
 * in _layout.tsx but remain navigable via `router.push`, so deep
 * links from push notifications + the Home tab still resolve.
 */
export default function WorkTabScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation(["home", "nav", "common"]);
  const accent = tokens.accent;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("tabs.work", { ns: "nav" })}</Text>
      <Text style={styles.subtitle}>{t("v2.tab_subtitle.work", { ns: "home" })}</Text>

      <HomeFeatureGrid>
        <HomeFeatureTile
          icon={<Ionicons name="people-outline" size={24} color={accent} />}
          label={t("v2.tiles.leads", { ns: "home" })}
          accentColor={accent}
          href="/(tabs)/leads"
        />
        <HomeFeatureTile
          icon={<Ionicons name="checkmark-circle-outline" size={24} color={accent} />}
          label={t("v2.tiles.tasks", { ns: "home" })}
          accentColor={accent}
          href="/tasks"
        />
        <HomeFeatureTile
          icon={<Ionicons name="calendar-outline" size={24} color={accent} />}
          label={t("v2.tiles.calendar", { ns: "home" })}
          accentColor={accent}
          href="/(tabs)/calendar"
        />
        <HomeFeatureTile
          icon={<Ionicons name="eye-outline" size={24} color={accent} />}
          label={t("v2.tiles.showings", { ns: "home" })}
          accentColor={accent}
          href="/showings"
        />
        <HomeFeatureTile
          icon={<Ionicons name="flash-outline" size={24} color={accent} />}
          label={t("v2.tiles.quick_post", { ns: "home" })}
          accentColor={accent}
          href="/quick-post"
          badge={{ label: "NEW", variant: "new" }}
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
