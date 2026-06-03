/**
 * LogoMark — The HelmSmart molecular node-ring symbol.
 *
 * Geometry (all values derived from `size`):
 * - 8 nodes arranged in a ring at 45° intervals (starting from top, clockwise)
 * - 4 stub extensions at cardinal directions (top, right, bottom, left)
 * - Bold letter centered inside the ring
 */

export interface LogoMarkProps {
  /** The letter rendered inside the ring. Defaults to 'H'. */
  letter?: string;
  /** Fill / stroke color. Accepts any CSS color value or custom property. Defaults to 'var(--brand)'. */
  color?: string;
  /** Overall size in pixels. Both width and height are set to this value. Defaults to 32. */
  size?: number;
  /** Additional class names for the root <svg> element. */
  className?: string;
}

export function LogoMark({
  letter = 'H',
  color = 'var(--brand)',
  size = 32,
  className,
}: LogoMarkProps) {
  const cx = size / 2;
  const cy = size / 2;

  // Derived geometric constants
  const ringRadius = size * 0.34375;   // radius of the node ring
  const nodeRadius = size * 0.09375;   // radius of each node circle
  const strokeWidth = size * 0.0703125; // width of the connecting ring stroke
  const stubExt = size * 0.140625;     // stub extension length beyond the node
  const fontSize = size * 0.44;
  const letterY = cy + fontSize * 0.36;

  // 8 node angles: 0° = top, clockwise
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  // Compute node centre positions
  const nodes = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + ringRadius * Math.sin(rad),
      y: cy - ringRadius * Math.cos(rad),
      deg,
    };
  });

  // Cardinal stubs (0°, 90°, 180°, 270°)
  const cardinalAngles = new Set([0, 90, 180, 270]);
  const stubs = nodes
    .filter((n) => cardinalAngles.has(n.deg))
    .map((n) => {
      const rad = (n.deg * Math.PI) / 180;
      // Outer endpoint of the stub
      const ox = n.x + stubExt * Math.sin(rad);
      const oy = n.y - stubExt * Math.cos(rad);
      return { x1: n.x, y1: n.y, x2: ox, y2: oy };
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Connecting ring */}
      <circle
        cx={cx}
        cy={cy}
        r={ringRadius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={0.28}
      />

      {/* Cardinal stub lines */}
      {stubs.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={color}
          strokeWidth={strokeWidth * 0.75}
          strokeLinecap="round"
        />
      ))}

      {/* 8 node circles */}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={nodeRadius}
          fill={color}
          fillOpacity={cardinalAngles.has(n.deg) ? 1 : 0.55}
        />
      ))}

      {/* Central letter */}
      <text
        x={cx}
        y={letterY}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={fontSize}
        fontWeight="800"
        fill={color}
        letterSpacing="-0.02em"
      >
        {letter}
      </text>
    </svg>
  );
}
