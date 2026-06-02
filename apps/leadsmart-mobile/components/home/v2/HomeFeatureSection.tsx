import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeTokens } from "../../../lib/useThemeTokens";
import type { ThemeTokens } from "../../../lib/theme";
import type { HomeFeatureSectionConfig } from "../../../lib/homeFeatures";
import { HomeFeatureGrid } from "./HomeFeatureGrid";
import { HomeFeatureTile } from "./HomeFeatureTile";
import { HomeSectionHeader } from "./HomeSectionHeader";

/**
 * Renders a single supercategory section — a labeled header above a card
 * that holds the tile grid — driven by a `HomeFeatureSectionConfig` from
 * `lib/homeFeatures.ts`.
 *
 * Both surfaces consume this component:
 * - `HomeFeatureSections.tsx` maps over all four sections for the Home tab.
 * - Per-tab files (`(tabs)/work.tsx` etc.) render just one section.
 *
 * Visual model mirrors the reference app-icon grid: each section is a
 * rounded "block" card, and every tile gets its own vibrant hue rendered
 * as a solid icon bubble with a white glyph (see TILE_COLORS).
 */

/**
 * Vibrant per-tile icon colors, keyed by `tile.key`. Presentation-only —
 * kept out of the data config so `homeFeatures.ts` stays about structure.
 * Tiles without an entry fall back to their section accent.
 */
const TILE_COLORS: Record<string, string> = {
  // Work
  leads: "#2563eb",
  tasks: "#16a34a",
  calendar: "#4f46e5",
  showings: "#0891b2",
  quick_post: "#7c3aed",
  expenses: "#0d9488",
  // Engage
  inbox: "#0284c7",
  postcards: "#db2777",
  scheduled: "#d97706",
  recurring: "#ea580c",
  post_history: "#9333ea",
  // Analyze
  cma: "#c026d3",
  sphere: "#e11d48",
  coaching: "#2563eb",
  briefings: "#0891b2",
  // Manage
  settings: "#475569",
  notifications: "#dc2626",
  connect_platforms: "#16a34a",
};

export function HomeFeatureSection({ section }: { section: HomeFeatureSectionConfig }) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation("home");
  const accent = tokens[section.accentKey];

  return (
    <>
      <HomeSectionHeader label={t(section.labelKey)} accentColor={accent} />
      <View style={styles.card}>
        <HomeFeatureGrid>
          {section.tiles.map((tile) => (
            <HomeFeatureTile
              key={tile.key}
              icon={<Ionicons name={tile.iconName} size={24} color="#ffffff" />}
              label={t(tile.labelKey)}
              accentColor={TILE_COLORS[tile.key] ?? accent}
              href={tile.href}
              badge={tile.badge}
            />
          ))}
        </HomeFeatureGrid>
      </View>
    </>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingTop: 12,
      paddingBottom: 2,
      ...theme.elevation.raised,
    },
  });
