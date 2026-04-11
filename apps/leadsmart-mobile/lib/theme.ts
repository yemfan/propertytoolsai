/**
 * Shared palette for LeadSmart mobile screens.
 *
 * Tokens are grouped by role so screens consume semantic names
 * (`infoBg`, `stagePillBg`, `dangerBg`) instead of hex literals.
 * Any new screen should import `theme` rather than introducing a
 * fresh hex string — that way when we wire dark-mode via
 * `useColorScheme()` in a follow-up batch, we only have to swap
 * this one object instead of chasing colors across every file.
 *
 * NOTE on dark mode: this palette is currently light-only. A
 * follow-up PR will introduce `useThemeTokens()` that returns the
 * right set based on `useColorScheme()` from react-native. Keeping
 * the surface tiny here so that refactor is mechanical.
 */
export const theme = {
  /* Base surfaces */
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceElevated: "#f1f5f9",
  surfaceMuted: "#f8fafc",
  border: "#e2e8f0",
  borderSubtle: "#f1f5f9",

  /* Text */
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  textSecondary: "#475569",
  textOnAccent: "#ffffff",

  /* Brand accent (primary blue) */
  accent: "#0072ce",
  accentLight: "#e0f2fe",
  accentDark: "#005ca8",
  accentPressed: "#eff6ff",

  /* Success / positive */
  success: "#28a745",
  successDark: "#15803d",
  successLight: "#f0fdf4",
  successBg: "#dcfce7",
  successBorder: "#bbf7d0",
  successText: "#14532d",
  successTextDark: "#166534",
  successButton: "#16a34a",

  /* Warning / orange */
  orange: "#ff8c42",
  orangeLight: "#fff7ed",
  warning: "#b45309",
  warningBg: "#fefce8",
  warningBorder: "#fef08a",

  /* Danger / error */
  danger: "#b91c1c",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  dangerTitle: "#991b1b",
  dangerBody: "#7f1d1d",
  /** @deprecated use `dangerBg` */
  errorBg: "#fef2f2",
  /** @deprecated use `dangerBorder` */
  errorBorder: "#fecaca",
  /** @deprecated use `dangerTitle` */
  errorTitle: "#991b1b",
  /** @deprecated use `dangerBody` */
  errorBody: "#7f1d1d",

  /* Hot-lead callouts (reused across home + leads screens) */
  hotBg: "#fff7ed",
  hotBorder: "#ea580c",
  hotPillBg: "#ffedd5",
  hotPillText: "#9a3412",
  hotLabel: "#c2410c",
  hotCallout: "#fed7aa",
  overdueBg: "#fefce8",
  overdueBorder: "#fef08a",

  /* Info / stage pill (light-blue on navy text — used by stage
   * pills on lead rows, hint banners, tappable quick-actions). */
  infoBg: "#eff6ff",
  infoBgAlt: "#f0f9ff",
  infoBorder: "#bfdbfe",
  infoText: "#1e40af",
  infoTextDeep: "#1e3a8a",
  infoAccent: "#3b82f6",

  /* Chip / filter active state (dark blue pill) */
  chipActiveBg: "#1e40af",
  chipActiveBorder: "#1e40af",
  chipActiveText: "#ffffff",
} as const;
