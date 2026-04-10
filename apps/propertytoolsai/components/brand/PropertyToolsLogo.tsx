import Image from "next/image";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  /** Smaller variant for footers / compact nav */
  compact?: boolean;
  /** LCP — default true when not compact */
  priority?: boolean;
};

/**
 * PropertyTools AI horizontal lockup — `public/images/ptlogo.png` (same pattern as LeadSmart `LeadSmartLogo`).
 * `unoptimized` serves `/images/*` directly (see LeadSmartLogo — avoids flaky `/_next/image` on some deploys).
 *
 * Sizing: the source PNG is 540×162 (3.33:1) so every 1px of height = 3.33px
 * of width. Modern SaaS nav logos sit around 28–36px tall; anything larger
 * reads as amateur (Linear, Stripe, Vercel, Notion reference). These defaults
 * render the logo at ~32px tall across all viewports instead of the previous
 * 64–96px, which freed ~60px of vertical space on the hero and removed the
 * "oversized template logo" look flagged by the design review.
 *
 * If a specific surface really needs a larger lockup (e.g. a hero splash),
 * override with the `className` prop (e.g. `className="h-12"`).
 */
export default function PropertyToolsLogo({ className, compact, priority }: Props) {
  const isPriority = priority ?? !compact;

  return (
    <Image
      src="/images/ptlogo.png"
      alt="PropertyTools AI"
      width={540}
      height={162}
      sizes="(max-width: 640px) 110px, 130px"
      priority={isPriority}
      unoptimized
      className={cn(
        "w-auto max-w-full object-contain object-left",
        compact ? "h-7 sm:h-8" : "h-8 sm:h-9",
        className
      )}
    />
  );
}
