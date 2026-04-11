import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeTokens } from "../theme";
import { useThemeTokens } from "../useThemeTokens";

/**
 * Onboarding stylesheet — factory form.
 *
 * Previously this module exported a single module-scope
 * `onboardingStyles` built from the light palette at import
 * time, so every onboarding screen stayed light even when the
 * rest of the app had migrated to `useThemeTokens()`. The new
 * pattern: screens call `useOnboardingStyles()` which returns
 * a memoized StyleSheet for the active palette.
 *
 * Layout constants (padding, font sizes, touch-target sizing)
 * stay exactly as they were — the point of this refactor is
 * just plumbing colors through the theme hook.
 */
export function useOnboardingStyles() {
  const tokens = useThemeTokens();
  return useMemo(() => createOnboardingStyles(tokens), [tokens]);
}

const createOnboardingStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.bg },
    /**
     * Pairs with a <SafeAreaView edges={["top","bottom"]}> wrapper in each
     * onboarding screen. The SafeAreaView adds the notch/home-indicator
     * insets dynamically, then this block adds the usual 24 horizontal
     * + 20 vertical padding on top of the safe area. Earlier revisions
     * hardcoded `paddingTop: 56` as a fixed notch estimate, which was
     * too tall on iPhone SE and too short on Dynamic Island devices.
     */
    safePad: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 20,
      justifyContent: "space-between",
    },
    centerBlock: { flex: 1, justifyContent: "center" },
    kicker: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.accent,
      letterSpacing: 1.2,
      marginBottom: 12,
      textTransform: "uppercase",
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.text,
      lineHeight: 34,
      marginBottom: 12,
    },
    body: {
      fontSize: 16,
      color: theme.textMuted,
      lineHeight: 24,
    },
    primaryBtn: {
      backgroundColor: theme.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: theme.textOnAccent, fontSize: 16, fontWeight: "700" },
    /**
     * Back-chevron row used at the top of value/login/notifications.
     * A 44×44 hit target (WCAG 2.5.5) with a subtle background so
     * first-time users can actually tell it's tappable. Fixed height
     * so screens that hide it keep the same content offset.
     */
    backRow: {
      height: 44,
      paddingHorizontal: 20,
      justifyContent: "center",
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonPressed: {
      backgroundColor: theme.surfaceElevated,
    },
    backButtonText: {
      fontSize: 24,
      fontWeight: "600",
      color: theme.accent,
      lineHeight: 24,
    },
    secondaryBtn: {
      marginTop: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryBtnText: { color: theme.accent, fontSize: 15, fontWeight: "600" },
    muted: { fontSize: 13, color: theme.textSubtle, marginTop: 16, lineHeight: 20 },
    pagerDotRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 24 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border },
    dotActive: { backgroundColor: theme.accent, width: 22 },
    input: {
      marginTop: 20,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
      backgroundColor: theme.surface,
      minHeight: 120,
      textAlignVertical: "top",
    },
    error: { marginTop: 12, fontSize: 14, color: theme.dangerTitle },
  });

export type OnboardingStyles = ReturnType<typeof useOnboardingStyles>;
