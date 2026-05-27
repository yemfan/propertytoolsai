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
 * Four-section tile grid that mirrors the web `PremiumSidebarV2`
 * supercategories (Work / Engage / Analyze / Manage) on the mobile
 * Home tab. See `docs/HOME_REDESIGN_PLAN.md` for the feature mapping
 * and the rationale for which web features become tiles vs. land
 * under the "Open full dashboard on the web" footer link.
 *
 * Bottom-tab features (Inbox / Leads / Calendar / Settings) are
 * deliberately NOT duplicated as tiles — they're already one tap away
 * from anywhere via the persistent tab bar. The tile layout uses the
 * scarce home-tab real estate for the deeper features that otherwise
 * require a router.push.
 */

// Per-section accent — picked from the existing theme tokens so the
// sections feel like part of LeadSmart, not a third-party super-app.
//   Work    -> brand blue (the same accent used for primary CTAs)
//   Engage  -> success green (matches outbound-message states)
//   Analyze -> amber (matches the warning/insight tone)
//   Manage  -> textMuted (intentionally subdued — utilities, not the hero)
function useSectionAccents() {
  const tokens = useThemeTokens();
  return {
    work: tokens.accent,
    engage: tokens.success,
    analyze: tokens.warning,
    manage: tokens.textMuted,
  };
}

/** External URL for the web dashboard footer link. */
const WEB_DASHBOARD_URL = "https://leadsmart-ai.com/dashboard";

export function HomeFeatureSections() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const accents = useSectionAccents();
  const { t } = useTranslation(["home", "common"]);

  // ── WORK ───────────────────────────────────────────────────────
  // Bottom-tab `Leads` + `Calendar` cover the daily flow, so the
  // tiles surface the deeper Work features only.
  const workTiles = (
    <HomeFeatureGrid>
      <HomeFeatureTile
        icon={<Ionicons name="checkmark-circle-outline" size={24} color={accents.work} />}
        label={t("v2.tiles.tasks")}
        accentColor={accents.work}
        href="/tasks"
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
  );

  // ── ENGAGE ─────────────────────────────────────────────────────
  // Inbox is a bottom tab; these are the asynchronous outbound
  // surfaces (the "things you set up, not things you reply to").
  const engageTiles = (
    <HomeFeatureGrid>
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
  );

  // ── ANALYZE ────────────────────────────────────────────────────
  const analyzeTiles = (
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
  );

  // ── MANAGE ─────────────────────────────────────────────────────
  // Settings is a bottom tab. These are the deeper account
  // surfaces (notification preferences + social-platform OAuth).
  const manageTiles = (
    <HomeFeatureGrid>
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
  );

  // ── Footer "Open full dashboard on the web" ────────────────────
  // 17 features in nav.config.tsx are web-only; surfacing them as
  // grayed-out tiles would be 17 wasted impressions + Apple's review
  // sometimes flags non-functional tiles as "incomplete." One
  // honest link keeps the home page tidy and discoverable.
  const onOpenWebDashboard = () => {
    hapticButtonPress();
    void Linking.openURL(WEB_DASHBOARD_URL);
  };

  return (
    <View>
      <HomeSectionHeader label={t("v2.sections.work")} accentColor={accents.work} />
      {workTiles}

      <HomeSectionHeader label={t("v2.sections.engage")} accentColor={accents.engage} />
      {engageTiles}

      <HomeSectionHeader label={t("v2.sections.analyze")} accentColor={accents.analyze} />
      {analyzeTiles}

      <HomeSectionHeader label={t("v2.sections.manage")} accentColor={accents.manage} />
      {manageTiles}

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
