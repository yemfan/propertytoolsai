import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useThemeTokens } from "../../../lib/useThemeTokens";
import type { HomeFeatureSectionConfig } from "../../../lib/homeFeatures";
import { HomeFeatureGrid } from "./HomeFeatureGrid";
import { HomeFeatureTile } from "./HomeFeatureTile";
import { HomeSectionHeader } from "./HomeSectionHeader";

/**
 * Renders a single supercategory section — header + tile grid — driven
 * entirely by a `HomeFeatureSectionConfig` from `lib/homeFeatures.ts`.
 *
 * Both surfaces consume this component:
 *
 * - `HomeFeatureSections.tsx` maps over all four sections to render the
 *   Home tab's full launcher.
 * - Per-tab files (`(tabs)/work.tsx` etc.) render just one section by
 *   calling `getHomeFeatureSection("work")`.
 *
 * The accent color is resolved here via `useThemeTokens()` so dark
 * mode flips automatically — sections don't need to thread theme
 * tokens through their props.
 */
export function HomeFeatureSection({ section }: { section: HomeFeatureSectionConfig }) {
  const tokens = useThemeTokens();
  const { t } = useTranslation("home");
  const accent = tokens[section.accentKey];

  return (
    <>
      <HomeSectionHeader label={t(section.labelKey)} accentColor={accent} />
      <HomeFeatureGrid>
        {section.tiles.map((tile) => (
          <HomeFeatureTile
            key={tile.key}
            icon={<Ionicons name={tile.iconName} size={24} color={accent} />}
            label={t(tile.labelKey)}
            accentColor={accent}
            href={tile.href}
            badge={tile.badge}
          />
        ))}
      </HomeFeatureGrid>
    </>
  );
}
