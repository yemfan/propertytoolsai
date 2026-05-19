/**
 * Theming for the financial-services vertical.
 *
 * Lets us swap between a generic finance look and a partner-branded look
 * (GFI for the first pitch) via a single env var, without touching layout code.
 *
 * Set `NEXT_PUBLIC_FINANCIAL_SERVICES_THEME` to `gfi` for the GFI pitch demo,
 * or leave unset for the generic palette.
 */
export type FinancialServicesTheme = {
  /** Optional partner brand name shown in headers/badges. */
  partnerName: string | null;
  /** Tailwind class for the hero background gradient. */
  heroBg: string;
  /** Tailwind class for primary CTA backgrounds. */
  ctaBg: string;
  /** Tailwind class for accent text (partner color). */
  accentText: string;
  /** Tailwind class for accent icons (partner color). */
  accentIcon: string;
};

const GENERIC: FinancialServicesTheme = {
  partnerName: null,
  heroBg: "bg-gradient-to-br from-indigo-900 via-violet-900 to-slate-900",
  ctaBg: "bg-indigo-600 hover:bg-indigo-500",
  accentText: "text-indigo-300",
  accentIcon: "text-indigo-600",
};

const GFI: FinancialServicesTheme = {
  partnerName: "GFI",
  heroBg: "bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900",
  ctaBg: "bg-amber-500 hover:bg-amber-400 text-slate-900",
  accentText: "text-amber-300",
  accentIcon: "text-amber-600",
};

const WFG: FinancialServicesTheme = {
  partnerName: "WFG",
  heroBg: "bg-gradient-to-br from-red-950 via-red-900 to-slate-900",
  ctaBg: "bg-red-600 hover:bg-red-500",
  accentText: "text-red-300",
  accentIcon: "text-red-600",
};

const PFO: FinancialServicesTheme = {
  partnerName: "PFO",
  heroBg: "bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900",
  ctaBg: "bg-emerald-600 hover:bg-emerald-500",
  accentText: "text-emerald-300",
  accentIcon: "text-emerald-600",
};

const THEMES: Record<string, FinancialServicesTheme> = {
  gfi: GFI,
  wfg: WFG,
  pfo: PFO,
  generic: GENERIC,
};

export function getFinancialServicesTheme(): FinancialServicesTheme {
  const key = (process.env.NEXT_PUBLIC_FINANCIAL_SERVICES_THEME || "").toLowerCase().trim();
  return THEMES[key] ?? GENERIC;
}
