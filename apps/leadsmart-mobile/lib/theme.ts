/**
 * Shared palette for LeadSmart mobile screens.
 *
 * Two full token sets (`lightTheme` / `darkTheme`) with identical
 * shape so the `useThemeTokens()` hook can swap between them based
 * on the OS color scheme. The legacy `theme` export is kept as an
 * alias for `lightTheme` so older screens that still import it
 * directly keep compiling — the goal is to migrate everything
 * through `useThemeTokens()` in a future sweep, but that refactor
 * is mechanical and doesn't have to land in one PR.
 *
 * Token naming is semantic (`infoBg`, `stagePillBg`, `dangerBg`)
 * instead of hex literals so screens only consume the role they
 * care about. Adding a new brand/visual accent goes here first,
 * not into a screen-level StyleSheet.
 */

type Tokens = {
  /* Base surfaces */
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderSubtle: string;

  /* Text */
  text: string;
  textMuted: string;
  textSubtle: string;
  textSecondary: string;
  textOnAccent: string;

  /* Brand accent */
  accent: string;
  accentLight: string;
  accentDark: string;
  accentPressed: string;

  /* Success / positive */
  success: string;
  successDark: string;
  successLight: string;
  successBg: string;
  successBorder: string;
  successText: string;
  successTextDark: string;
  successButton: string;

  /* Warning / orange */
  orange: string;
  orangeLight: string;
  warning: string;
  warningBg: string;
  warningBorder: string;

  /* Danger / error */
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  dangerTitle: string;
  dangerBody: string;
  /** @deprecated use `dangerBg` */
  errorBg: string;
  /** @deprecated use `dangerBorder` */
  errorBorder: string;
  /** @deprecated use `dangerTitle` */
  errorTitle: string;
  /** @deprecated use `dangerBody` */
  errorBody: string;

  /* Hot-lead callouts */
  hotBg: string;
  hotBorder: string;
  hotPillBg: string;
  hotPillText: string;
  hotLabel: string;
  hotCallout: string;
  overdueBg: string;
  overdueBorder: string;

  /* Info / stage pill */
  infoBg: string;
  infoBgAlt: string;
  infoBorder: string;
  infoText: string;
  infoTextDeep: string;
  infoAccent: string;

  /* Chip / filter active state */
  chipActiveBg: string;
  chipActiveBorder: string;
  chipActiveText: string;

  /* Skeleton loader shimmer */
  skeletonBase: string;
  skeletonHighlight: string;
};

export const lightTheme: Tokens = {
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceElevated: "#f1f5f9",
  surfaceMuted: "#f8fafc",
  border: "#e2e8f0",
  borderSubtle: "#f1f5f9",

  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  textSecondary: "#475569",
  textOnAccent: "#ffffff",

  accent: "#0072ce",
  accentLight: "#e0f2fe",
  accentDark: "#005ca8",
  accentPressed: "#eff6ff",

  success: "#28a745",
  successDark: "#15803d",
  successLight: "#f0fdf4",
  successBg: "#dcfce7",
  successBorder: "#bbf7d0",
  successText: "#14532d",
  successTextDark: "#166534",
  successButton: "#16a34a",

  orange: "#ff8c42",
  orangeLight: "#fff7ed",
  warning: "#b45309",
  warningBg: "#fefce8",
  warningBorder: "#fef08a",

  danger: "#b91c1c",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  dangerTitle: "#991b1b",
  dangerBody: "#7f1d1d",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  errorTitle: "#991b1b",
  errorBody: "#7f1d1d",

  hotBg: "#fff7ed",
  hotBorder: "#ea580c",
  hotPillBg: "#ffedd5",
  hotPillText: "#9a3412",
  hotLabel: "#c2410c",
  hotCallout: "#fed7aa",
  overdueBg: "#fefce8",
  overdueBorder: "#fef08a",

  infoBg: "#eff6ff",
  infoBgAlt: "#f0f9ff",
  infoBorder: "#bfdbfe",
  infoText: "#1e40af",
  infoTextDeep: "#1e3a8a",
  infoAccent: "#3b82f6",

  chipActiveBg: "#1e40af",
  chipActiveBorder: "#1e40af",
  chipActiveText: "#ffffff",

  skeletonBase: "#e2e8f0",
  skeletonHighlight: "#f1f5f9",
};

/**
 * Dark theme — hand-tuned for contrast on OLED iPhones and AMOLED
 * Androids, not just inverted from the light palette. Backgrounds
 * sit at slate-950/900/800 so pure-black OLED battery savings
 * still apply while keeping enough separation between surface
 * levels that cards don't vanish into the background.
 */
export const darkTheme: Tokens = {
  bg: "#0b1220", // deep slate near-black
  surface: "#111a2e",
  surfaceElevated: "#1a243c",
  surfaceMuted: "#0f1830",
  border: "#1f2a44",
  borderSubtle: "#172034",

  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textSubtle: "#64748b",
  textSecondary: "#cbd5e1",
  textOnAccent: "#ffffff",

  accent: "#4da3e8", // lighter blue for dark bg contrast
  accentLight: "#1e3a5f",
  accentDark: "#7dbaf0",
  accentPressed: "#1e3a5f",

  success: "#22c55e",
  successDark: "#4ade80",
  successLight: "#0f2a1a",
  successBg: "#0f2a1a",
  successBorder: "#14532d",
  successText: "#86efac",
  successTextDark: "#4ade80",
  successButton: "#22c55e",

  orange: "#fb923c",
  orangeLight: "#2a1a0a",
  warning: "#facc15",
  warningBg: "#2a2209",
  warningBorder: "#ca8a04",

  danger: "#f87171",
  dangerBg: "#2a0e0e",
  dangerBorder: "#7f1d1d",
  dangerTitle: "#fca5a5",
  dangerBody: "#fecaca",
  errorBg: "#2a0e0e",
  errorBorder: "#7f1d1d",
  errorTitle: "#fca5a5",
  errorBody: "#fecaca",

  hotBg: "#2a1a0a",
  hotBorder: "#f97316",
  hotPillBg: "#3a1f0a",
  hotPillText: "#fdba74",
  hotLabel: "#fb923c",
  hotCallout: "#3a1f0a",
  overdueBg: "#2a2209",
  overdueBorder: "#ca8a04",

  infoBg: "#162544",
  infoBgAlt: "#0e1c38",
  infoBorder: "#1e3a5f",
  infoText: "#93c5fd",
  infoTextDeep: "#bfdbfe",
  infoAccent: "#60a5fa",

  chipActiveBg: "#2563eb",
  chipActiveBorder: "#3b82f6",
  chipActiveText: "#ffffff",

  skeletonBase: "#1a243c",
  skeletonHighlight: "#26334d",
};

/**
 * Legacy alias — existing screens that `import { theme }` still
 * get the light palette. New code should prefer
 * `useThemeTokens()` from `lib/useThemeTokens.ts` so the values
 * follow the OS color scheme.
 */
export const theme = lightTheme;

export type ThemeTokens = Tokens;
