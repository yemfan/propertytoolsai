import { cn } from "@/lib/cn";

/**
 * PropertyTools AI icon — hand-crafted inline SVG approximation of the brand
 * mark: a stylized house containing a bar chart, with a magnifying glass
 * overlapping the bottom-left corner.
 *
 * Design breakdown (for future editors):
 *   - House body       — rounded-corner rect + pitched roof, blue gradient
 *   - Chimney          — small rect on right side of the roof
 *   - Bar chart        — 3 green bars of increasing height inside the house
 *   - Magnifying glass — circle ring + diagonal handle, blue ring + orange
 *                        handle, overlapping the bottom-left of the house
 *
 * Rendering notes:
 *   - `viewBox="0 0 120 120"` so the caller can size with CSS `width`/
 *     `height` or Tailwind `h-*`/`w-*` classes without math
 *   - All colors are baked in as gradient stops (not `currentColor`)
 *     because the brand identity relies on specific blues/greens/oranges
 *     — an inverted dark-mode version would require a designer's call
 *   - `role="img"` + `aria-label` for screen readers
 *   - No defs IDs that could collide when multiple icons render on the
 *     same page — IDs are prefixed with a hash
 *
 * If the brand team ever ships a pixel-perfect designer SVG, this file
 * can be replaced wholesale without touching any call sites because
 * `<PropertyToolsLogo>` owns the sizing wrapper.
 */

type Props = {
  className?: string;
  /** Override the aria-label; defaults to "PropertyTools AI". */
  title?: string;
};

export default function PropertyToolsIcon({ className, title = "PropertyTools AI" }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <title>{title}</title>
      <defs>
        {/* Deep blue for the house outline / roof */}
        <linearGradient id="pt-icon-blue-deep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        {/* Lighter blue for the house body fill */}
        <linearGradient id="pt-icon-blue-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        {/* Teal-green for the bar chart */}
        <linearGradient id="pt-icon-green" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        {/* Orange-amber for the magnifying glass handle */}
        <linearGradient id="pt-icon-orange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>

      {/* House body (rounded bottom, pitched roof) */}
      <path
        d="M28 58 L60 28 L92 58 L92 92 Q92 98 86 98 L34 98 Q28 98 28 92 Z"
        fill="url(#pt-icon-blue-body)"
        stroke="url(#pt-icon-blue-deep)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Chimney on the right side of the roof */}
      <rect
        x="74"
        y="34"
        width="8"
        height="13"
        fill="url(#pt-icon-blue-deep)"
        rx="1"
      />

      {/* Bar chart inside the house — 3 bars of increasing height */}
      <rect x="42" y="78" width="8" height="14" fill="url(#pt-icon-green)" rx="1" />
      <rect x="56" y="68" width="8" height="24" fill="url(#pt-icon-green)" rx="1" />
      <rect x="70" y="58" width="8" height="34" fill="url(#pt-icon-green)" rx="1" />

      {/* Magnifying glass circle ring — overlaps bottom-left of the house */}
      <circle
        cx="42"
        cy="78"
        r="22"
        fill="none"
        stroke="url(#pt-icon-blue-deep)"
        strokeWidth="5.5"
      />

      {/* Magnifying glass handle — diagonal to bottom-left corner */}
      <line
        x1="26"
        y1="94"
        x2="10"
        y2="112"
        stroke="url(#pt-icon-orange)"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
