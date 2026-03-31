import Image from "next/image";
import { cn } from "@/lib/cn";
import logoSrc from "./ptlogo.png";

type Props = {
  className?: string;
  /** Smaller variant for footers / compact nav */
  compact?: boolean;
};

/**
 * Horizontal lockup — bundled with the app (`components/brand/ptlogo.png`) so it is emitted under
 * `/_next/static/media/` and does not depend on `public/images` (which can 404 on some deploys).
 */
export default function PropertyToolsLogo({ className, compact }: Props) {
  return (
    <Image
      src={logoSrc}
      alt="PropertyTools AI"
      width={540}
      height={162}
      priority
      className={cn(
        "h-auto w-auto max-w-full object-contain object-left",
        compact ? "h-11 max-h-12 sm:h-12" : "h-16 max-h-20 sm:h-20 md:h-24",
        className
      )}
    />
  );
}
