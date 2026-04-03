import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Smaller variant for footers / compact nav */
  compact?: boolean;
  /** LCP — default true when not compact */
  priority?: boolean;
};

/**
 * LeadSmart AI horizontal lockup — `public/images/lslogoh.png`.
 * `unoptimized` serves the file from `/images/*` directly so the logo is not dependent on `/_next/image`
 * (avoids sporadic blank logos when the image optimizer or edge cache misbehaves on some routes/deploys).
 */
export function LeadSmartLogo({ className, compact, priority }: Props) {
  const isPriority = priority ?? !compact;

  return (
    <Image
      src="/images/lslogoh.png"
      alt="LeadSmart AI"
      width={540}
      height={162}
      sizes="(max-width: 640px) 220px, (max-width: 1024px) 280px, 360px"
      priority={isPriority}
      unoptimized
      className={cn(
        "w-auto object-contain object-left",
        compact ? "h-11 max-h-12 sm:h-12" : "h-16 max-h-20 sm:h-20 md:h-24",
        className
      )}
    />
  );
}
