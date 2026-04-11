import { cn } from "@/lib/cn";
import PropertyToolsIcon from "@/components/brand/PropertyToolsIcon";

type Props = {
  className?: string;
  /** Smaller variant for footers / compact nav. */
  compact?: boolean;
  /**
   * Kept for backwards compatibility with the old PNG-based API — the
   * new implementation is pure inline SVG + HTML text so there's no
   * raster image to prioritize for LCP. Callers can still pass this
   * prop without breakage.
   */
  priority?: boolean;
  /**
   * Variant selector:
   *   - "full"     → icon + wordmark side by side (default)
   *   - "iconOnly" → just the SVG mark, no text
   *   - "textOnly" → just the colored wordmark, no icon
   */
  variant?: "full" | "iconOnly" | "textOnly";
};

/**
 * PropertyTools AI horizontal lockup — inline SVG icon + HTML text wordmark.
 *
 * Replaces the previous 540×162 PNG implementation with a hybrid approach:
 *   1. The brand mark (house + bar chart + magnifying glass) is rendered as
 *      an inline SVG via {@link PropertyToolsIcon}, so it stays crisp at
 *      any size and ships with zero network cost.
 *   2. The wordmark ("PropertyToolsAI") is rendered as HTML text using the
 *      site's existing `font-heading` (Montserrat 800), split into three
 *      `<span>` segments with the canonical brand colors:
 *
 *        - "Property" → deep navy blue  (#1e4d7e)
 *        - "Tools"    → teal            (#14a0b8)
 *        - "AI"       → warm amber      (#f5a623)
 *
 *      Using real HTML text (instead of SVG text or a rasterized wordmark)
 *      gives us crisp rendering at every size, proper font rasterization
 *      via Next's font optimization, selectable/searchable text for
 *      accessibility, and zero layout shift from waiting on an <img> load.
 *
 * Sizing: same defaults as before — `h-8 sm:h-9` (32-36px) on the default
 * variant, `h-7 sm:h-8` (28-32px) on `compact`. Override with `className`
 * when a specific surface needs a larger lockup. Icon and text scale
 * together so the visual proportions stay consistent.
 *
 * Migration from the old PNG: the props API is unchanged. Any call site
 * that passed `className="h-X"` still works. `priority` is now a no-op
 * but accepting it keeps `tsc` happy for existing callers.
 *
 * If the brand team ever ships a proper designer SVG of the icon, swap
 * `PropertyToolsIcon.tsx` wholesale — the wrapper here stays untouched.
 */
export default function PropertyToolsLogo({
  className,
  compact,
  variant = "full",
}: Props) {
  // Both icon and wordmark scale together off the container's font-size so
  // you get a consistent ratio at every breakpoint. Icon is a square (1:1),
  // wordmark is proportional to the font-size. At h-9 (36px) the whole
  // lockup comes out around ~140px wide — matches the old PNG's aspect
  // ratio closely enough that existing layouts don't shift.
  const sizeClasses = compact
    ? "h-7 text-[1.05rem] sm:h-8 sm:text-[1.15rem]"
    : "h-8 text-[1.15rem] sm:h-9 sm:text-[1.25rem]";

  const Wordmark = (
    <span
      className="font-heading whitespace-nowrap font-extrabold leading-none tracking-[-0.02em]"
      aria-hidden={variant === "full"}
    >
      <span className="text-[#1e4d7e]">Property</span>
      <span className="text-[#14a0b8]">Tools</span>
      <span className="text-[#f5a623]">AI</span>
    </span>
  );

  if (variant === "iconOnly") {
    return (
      <PropertyToolsIcon
        className={cn("aspect-square w-auto", compact ? "h-7 sm:h-8" : "h-8 sm:h-9", className)}
      />
    );
  }

  if (variant === "textOnly") {
    return (
      <span
        className={cn(
          "inline-flex items-center",
          sizeClasses,
          className
        )}
        role="img"
        aria-label="PropertyTools AI"
      >
        {Wordmark}
      </span>
    );
  }

  // Default: full lockup (icon + wordmark).
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 sm:gap-2.5",
        sizeClasses,
        className
      )}
      role="img"
      aria-label="PropertyTools AI"
    >
      <PropertyToolsIcon
        className={cn("aspect-square h-full w-auto")}
      />
      {Wordmark}
    </span>
  );
}
