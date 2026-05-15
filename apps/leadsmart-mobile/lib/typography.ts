/**
 * Mobile typography scale.
 *
 * Keys map to product surfaces (display, title, body, caption, …) and
 * resolve to a complete React Native text style — fontFamily,
 * fontWeight, fontSize, lineHeight, letterSpacing — so a screen can
 * write `<Text style={type.titleLg}>` and trust that every render of
 * that role looks identical across the app.
 *
 * Font names match the `@expo-google-fonts/geist` exports loaded in
 * `app/_layout.tsx`. While the fonts are still loading on first
 * launch, RN falls back to the platform's system sans (San Francisco
 * on iOS, Roboto on Android) — the metrics are close enough to Geist
 * that layout doesn't shift much when the swap happens.
 */

import type { TextStyle } from "react-native";

const FAMILY = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  mono: "GeistMono_500Medium",
} as const;

/**
 * Tabular numerics — opt-in on stat values, table cells, anything that
 * counts up or re-renders in place. iOS supports `fontVariant` natively;
 * Android falls back to the standard digit widths but the GeistMono
 * face we use here is already monospaced, so the result is the same.
 */
const tabularNumber: Pick<TextStyle, "fontVariant"> = {
  fontVariant: ["tabular-nums"],
};

export const type = {
  /** Hero / onboarding marquee. Tight letter-spacing + heavy weight. */
  displayLg: {
    fontFamily: FAMILY.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  } satisfies TextStyle,

  /** Section headers, biggest screen titles. */
  displayMd: {
    fontFamily: FAMILY.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
  } satisfies TextStyle,

  /** Card titles, stat labels above the value. */
  titleLg: {
    fontFamily: FAMILY.semibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.1,
  } satisfies TextStyle,

  /** Sub-section heads. */
  titleMd: {
    fontFamily: FAMILY.semibold,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,

  /** Default body copy. */
  body: {
    fontFamily: FAMILY.regular,
    fontSize: 15,
    lineHeight: 22,
  } satisfies TextStyle,

  /** Emphasised body — link text, primary labels. */
  bodyEmphasis: {
    fontFamily: FAMILY.medium,
    fontSize: 15,
    lineHeight: 22,
  } satisfies TextStyle,

  /** Helper text under inputs, secondary metadata. */
  caption: {
    fontFamily: FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  } satisfies TextStyle,

  /** All-caps eyebrow above section heads. */
  kicker: {
    fontFamily: FAMILY.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  } satisfies TextStyle,

  /** Bottom tab labels — paired with Ionicons in `(tabs)/_layout.tsx`. */
  tabLabel: {
    fontFamily: FAMILY.medium,
    fontSize: 11,
    lineHeight: 14,
  } satisfies TextStyle,

  /** Stat-card value: monospaced + tabular so digits don't jitter on
   *  re-render. Pair with `tokens.text` for color. */
  statValue: {
    fontFamily: FAMILY.mono,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    ...tabularNumber,
  } satisfies TextStyle,

  /** Inline numbers in body copy (lead count badges, agenda counts). */
  number: {
    fontFamily: FAMILY.mono,
    fontSize: 15,
    lineHeight: 22,
    ...tabularNumber,
  } satisfies TextStyle,
} as const;

export type TypeKey = keyof typeof type;

/**
 * The list of @expo-google-fonts module exports we depend on. Kept here
 * so `_layout.tsx` and this file stay in sync — bumping a weight in
 * one place updates both font loading and the scale.
 */
export const REQUIRED_FONT_KEYS = [
  "Geist_400Regular",
  "Geist_500Medium",
  "Geist_600SemiBold",
  "Geist_700Bold",
  "GeistMono_500Medium",
] as const;
