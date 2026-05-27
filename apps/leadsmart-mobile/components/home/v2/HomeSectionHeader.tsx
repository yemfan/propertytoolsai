import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeTokens } from "../../../lib/useThemeTokens";
import type { ThemeTokens } from "../../../lib/theme";

/**
 * Supercategory label that sits above a HomeFeatureGrid in the v1.6 Home
 * redesign. Matches the web sidebar's "section-label" rendering:
 * uppercase, letter-spaced, muted. The left side carries a 3px tall
 * pill in the section accent so the four sections are visually
 * distinguishable at a glance.
 */
export type HomeSectionHeaderProps = {
  /** Localized label — "Work", "Engage", "Analyze", "Manage". */
  label: string;
  /** Per-section accent color (see HOME_REDESIGN_PLAN.md). */
  accentColor: string;
};

export function HomeSectionHeader({ label, accentColor }: HomeSectionHeaderProps) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={[styles.pill, { backgroundColor: accentColor }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 24,
      marginBottom: 12,
      gap: 8,
    },
    pill: {
      width: 4,
      height: 14,
      borderRadius: 2,
    },
    label: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: theme.textMuted,
    },
  });
