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
 * Brand lockup from `public/images/ptlogo.png` (shared with Property Tools artwork).
 * Add or replace that file under `apps/leadsmart-ai/public/images/` as needed.
 */
export function LeadSmartLogo({ className, compact, priority }: Props) {
  const isPriority = priority ?? !compact;

  return (
    <Image
      src="/images/ptlogo.png"
      alt="LeadSmart AI"
      width={480}
      height={144}
      priority={isPriority}
      className={cn(
        "w-auto object-contain object-left",
        compact ? "h-11 max-h-12 sm:h-12" : "h-16 max-h-20 sm:h-20 md:h-24",
        className
      )}
    />
  );
}
