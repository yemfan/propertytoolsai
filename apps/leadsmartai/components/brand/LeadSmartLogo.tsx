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
 * LeadSmart AI horizontal lockup — `public/images/ptlog.png` (Property Tools / LeadSmart mark).
 */
export function LeadSmartLogo({ className, compact, priority }: Props) {
  const isPriority = priority ?? !compact;

  return (
    <Image
      src="/images/ptlog.png"
      alt="LeadSmart AI"
      width={540}
      height={162}
      priority={isPriority}
      className={cn(
        "w-auto object-contain object-left",
        compact ? "h-11 max-h-12 sm:h-12" : "h-16 max-h-20 sm:h-20 md:h-24",
        className
      )}
    />
  );
}
