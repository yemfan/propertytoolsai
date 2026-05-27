import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { useThemeTokens } from "../../../lib/useThemeTokens";
import type { ThemeTokens } from "../../../lib/theme";
import { HomeFeatureGrid } from "./HomeFeatureGrid";
import { HomeFeatureTile } from "./HomeFeatureTile";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { hapticButtonPress } from "../../../lib/haptics";

/**
 * Comprehensive 4-section tile grid for the Home tab — all 17
 * features visible in one scroll, grouped by web supercategory
 * (Work / Engage / Analyze / Manage).
 *
 * Duplicates the per-tab tile data in `(tabs)/work.tsx`,
 * `engage.tsx`, `analyze.tsx`, and `manage.tsx`. Kept in sync by
 * convention for v1.6; if the lists diverge significantly, extract
 * to `lib/homeFeatures.ts` and have both consume the same config.
 *
 * Home shows everything as a launcher; the per-tab tabs show the
 * same per-category subset for users who navigate via the bottom
 * tab bar. Both paths land on the same downstream screens.
 */

const WEB_DASHBOARD_URL = "https://leadsmart-ai.com/dashboard";

function useSectionAccents() {
  const tokens = useThemeTokens();
  return {
    work: tokens.accent,
    engage: tokens.success,
    analyze: tokens.warning,
    manage: tokens.textMuted,
  };
}

export function HomeFeatureSections() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const accents = useSectionAccents();
  const { t } = useTranslation(["home", "common"]);

  const onOpenWebDashboard = () => {
    hapticButtonPress();
    void Linking.openURL(WEB_DASHBOARD_URL);
  };

  return (
    <View>
      {/* WORK */}
      <HomeSectionHeader label={t("v2.sections.work")} accentColor={accents.work} />
      <HomeFeatureGrid>
        <HomeFeatureTile
          icon={<Ionicons name="people-outline" size={24} color={accents.work} />}
          label={t("v2.tiles.leads")}
          accentColor={accents.work}
          href="/(tabs)/leads"
        />
        <HomeFeatureTile
          icon={<Ionicons name="checkmark-circle-outline" size={24} color={accents.work} />}
          label={t("v2.tiles.tasks")}
          accentColor={accents.work}
          href="/tasks"
        />
        <HomeFeatureTile
          icon={<Ionicons name="calendar-outline" size={24} color={accents.work} />}
          label={t("v2.tiles.calendar")}
          accentColor={accents.work}
          href="/(tabs)/calendar"
        />
        <HomeFeatureTile
          icon={<Ionicons name="eye-outline" size={24} color={accents.work} />}
          label={t("v2.tiles.showings")}
          accentColor={accents.work}
          href="/showings"
        />
        <HomeFeatureTile
          icon={<Ionicons name="flash-outline" size={24} color={accents.work} />}
          label={t("v2.tiles.quick_post")}
          accentColor={accents.work}
          href="/quick-post"
          badge={{ label: "NEW", variant: "new" }}
        />
      </HomeFeatureGrid>

      {/* ENGAGE */}
      <HomeSectionHeader label={t("v2.sections.engage")} accentColor={accents.engage} />
      <HomeFeatureGrid>
        <HomeFeatureTile
          icon={<Ionicons name="chatbubble-outline" size={24} color={accents.engage} />}
          label={t("v2.tiles.inbox")}
          accentColor={accents.engage}
          href="/(tabs)/inbox"
        />
        <HomeFeatureTile
          icon={<Ionicons name="mail-outline" size={24} color={accents.engage} />}
          label={t("v2.tiles.postcards")}
          accentColor={accents.engage}
          href="/postcards"
        />
        <HomeFeatureTile
          icon={<Ionicons name="time-outline" size={24} color={accents.engage} />}
          label={t("v2.tiles.scheduled")}
          accentColor={accents.engage}
          href="/scheduled"
        />
        <HomeFeatureTile
          icon={<Ionicons name="refresh-outline" size={24} color={accents.engage} />}
          label={t("v2.tiles.recurring")}
          accentColor={accents.engage}
          href="/recurring"
        />
        <HomeFeatureTile
          icon={<Ionicons name="archive-outline" size={24} color={accents.engage} />}
          label={t("v2.tiles.post_history")}
          accentColor={accents.engage}
          href="/post-history"
        />
      </HomeFeatureGrid>

      {/* ANALYZE */}
      <HomeSectionHeader label={t("v2.sections.analyze")} accentColor={accents.analyze} />
      <HomeFeatureGrid>
        <HomeFeatureTile
          icon={<Ionicons name="analytics-outline" size={24} color={accents.analyze} />}
          label={t("v2.tiles.cma")}
          accentColor={accents.analyze}
          href="/cma"
        />
        <HomeFeatureTile
          icon={<Ionicons name="people-outline" size={24} color={accents.analyze} />}
          label={t("v2.tiles.sphere")}
          accentColor={accents.analyze}
          href="/sphere"
        />
        <HomeFeatureTile
          icon={<Ionicons name="school-outline" size={24} color={accents.analyze} />}
          label={t("v2.tiles.coaching")}
          accentColor={accents.analyze}
          href="/coaching"
        />
        <HomeFeatureTile
          icon={<Ionicons name="newspaper-outline" size={24} color={accents.analyze} />}
          label={t("v2.tiles.briefings")}
          accentColor={accents.analyze}
          href="/briefings"
        />
      </HomeFeatureGrid>

      {/* MANAGE */}
      <HomeSectionHeader label={t("v2.sections.manage")} accentColor={accents.manage} />
      <HomeFeatureGrid>
        <HomeFeatureTile
          icon={<Ionicons name="settings-outline" size={24} color={accents.manage} />}
          label={t("v2.tiles.settings")}
          accentColor={accents.manage}
          href="/(tabs)/settings"
        />
        <HomeFeatureTile
          icon={<Ionicons name="notifications-outline" size={24} color={accents.manage} />}
          label={t("v2.tiles.notifications")}
          accentColor={accents.manage}
          href="/notifications"
        />
        <HomeFeatureTile
          icon={<Ionicons name="link-outline" size={24} color={accents.manage} />}
          label={t("v2.tiles.connect_platforms")}
          accentColor={accents.manage}
          href="/connect-platforms"
        />
      </HomeFeatureGrid>

      <Pressable
        onPress={onOpenWebDashboard}
        style={({ pressed }) => [styles.webLink, pressed && styles.webLinkPressed]}
        accessibilityRole="link"
        accessibilityLabel={t("v2.web_link.label")}
      >
        <Ionicons
          name="open-outline"
          size={16}
          color={tokens.accent}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.webLinkText}>{t("v2.web_link.label")}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    webLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 24,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    webLinkPressed: {
      opacity: 0.85,
    },
    webLinkText: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: "600",
    },
  });
