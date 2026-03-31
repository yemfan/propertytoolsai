import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  /** Smaller variant for footers / compact nav */
  compact?: boolean;
};

/**
 * PropertyTools AI horizontal lockup — `public/images/ptlog.png`.
 * Uses a plain `img` so the logo always loads from `/public` (no `next/image` optimizer edge cases).
 */
export default function PropertyToolsLogo({ className, compact }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public asset; avoids Image optimizer edge cases on deploy
    <img
      src="/images/ptlog.png"
      alt="PropertyTools AI"
      width={540}
      height={162}
      decoding="async"
      className={cn(
        "h-auto w-auto max-w-full object-contain object-left",
        compact ? "h-11 max-h-12 sm:h-12" : "h-16 max-h-20 sm:h-20 md:h-24",
        className
      )}
    />
  );
}
