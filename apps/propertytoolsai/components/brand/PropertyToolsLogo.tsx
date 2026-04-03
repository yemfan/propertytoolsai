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
 */
export default function PropertyToolsLogo({ className, compact, priority }: Props) {
  const isPriority = priority ?? !compact;

  return (
    <Image
      src="/images/ptlogo.png"
      alt="PropertyTools AI"
      width={540}
      height={162}
      sizes="(max-width: 640px) 220px, (max-width: 1024px) 280px, 360px"
      priority={isPriority}
      unoptimized
      className={cn(
        "w-auto max-w-full object-contain object-left",
        compact ? "h-11 max-h-12 sm:h-12" : "h-16 max-h-20 sm:h-20 md:h-24",
        className
      )}
    />
  );
}
