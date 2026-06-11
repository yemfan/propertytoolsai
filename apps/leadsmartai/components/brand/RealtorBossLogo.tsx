import { cn } from "@/lib/utils";

const NAVY = "#1E3A66";
const GOLD = "#D9A227";

/** The RealtorBoss "R + team nodes" mark, inline SVG (crisp at any size).
 *  Master asset: public/brand/realtorboss/realtorboss-mark.svg */
export function RealtorBossMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden className={cn("h-8 w-8", className)}>
      <g stroke={NAVY} strokeWidth={16}>
        <path d="M84 26 V112" />
        <path d="M84 34 H118 Q136 34 136 52 V54 Q136 72 118 72 H102" />
        <path d="M104 72 L131 106" />
      </g>
      <path d="M76 112 H140" stroke={NAVY} strokeWidth={10} />
      <g stroke={NAVY} strokeWidth={9}>
        <path d="M82 114 L48 142" />
        <path d="M100 114 V142" />
        <path d="M134 114 L152 142" />
      </g>
      <g>
        <circle cx="48" cy="151" r="13" fill="#fff" stroke={NAVY} strokeWidth={8} />
        <circle cx="48" cy="151" r="6.5" fill={GOLD} />
        <circle cx="100" cy="151" r="13" fill="#fff" stroke={NAVY} strokeWidth={8} />
        <circle cx="100" cy="151" r="6.5" fill={GOLD} />
        <circle cx="152" cy="151" r="13" fill="#fff" stroke={NAVY} strokeWidth={8} />
        <circle cx="152" cy="151" r="6.5" fill={GOLD} />
      </g>
    </svg>
  );
}

type Props = {
  className?: string;
  /** Smaller variant for footers / compact nav (hides the tagline). */
  compact?: boolean;
};

/**
 * RealtorBoss horizontal lockup — mark + two-tone wordmark (+ tagline).
 * Wordmark renders as text in the app's heading font, so it stays crisp
 * and theme-consistent. Gold is accent-only; the wordmark body is navy
 * for contrast (per brand review).
 */
export function RealtorBossLogo({ className, compact }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <RealtorBossMark className={compact ? "h-8 w-8" : "h-10 w-10"} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-heading font-bold tracking-tight", compact ? "text-lg" : "text-2xl")}>
          <span style={{ color: NAVY }}>Realtor</span>
          <span style={{ color: GOLD }}>Boss</span>
        </span>
        {!compact && (
          <span
            className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: NAVY }}
          >
            Your AI Real Estate Team
          </span>
        )}
      </span>
    </span>
  );
}
