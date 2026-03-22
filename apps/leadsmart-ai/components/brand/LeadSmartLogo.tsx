/**
 * Inline wordmark — works without `/public/images/lslogo.png`.
 * Drop a PNG/SVG into `public/images/` later and swap to next/image if you prefer.
 */
type Props = {
  className?: string;
  /** Slightly smaller mark + wordmark for footers */
  compact?: boolean;
};

export function LeadSmartLogo({ className = "h-9 w-auto", compact }: Props) {
  /** Wide enough for “LeadSmart AI” wordmark beside LS mark */
  const vb = compact ? "0 0 188 36" : "0 0 218 44";
  const fontSize = compact ? 16 : 19;
  const box = compact ? { y: 0, h: 36, w: 36, r: 9 } : { y: 2, h: 40, w: 40, r: 10 };
  const textY = compact ? 25 : 30;
  const textX = compact ? 44 : 48;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={vb}
      className={className}
      aria-label="LeadSmart AI"
      role="img"
    >
      <title>LeadSmart AI</title>
      <rect x="0" y={box.y} width={box.w} height={box.h} rx={box.r} fill="#0072ce" />
      <text
        x={box.w / 2}
        y={box.y + box.h * 0.68}
        textAnchor="middle"
        fill="white"
        fontSize={compact ? 13 : 15}
        fontWeight="800"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
      >
        LS
      </text>
      <text
        x={textX}
        y={textY}
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize={fontSize}
        fontWeight="700"
      >
        <tspan fill="#0f172a">LeadSmart </tspan>
        <tspan fill="#0072ce">AI</tspan>
      </text>
    </svg>
  );
}
