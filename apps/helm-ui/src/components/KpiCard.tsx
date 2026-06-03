/**
 * KpiCard — Compact metric tile used in dashboard grids.
 * Supports loading skeleton, null "not yet tracked" state, trend coloring, and deeplink.
 */

import React from 'react';

export interface KpiCardProps {
  /** Metric label, displayed in small uppercase. */
  label: string;
  /**
   * The metric value. Pass null to render a "— Not yet tracked" placeholder.
   */
  value: string | number | null;
  /**
   * Delta string, e.g. "↑ 8%" or "↓ 12%". Displayed below the value.
   * Color is determined by trend + goodDirection.
   */
  delta?: string;
  /** Direction of change. */
  trend?: 'up' | 'down' | 'flat';
  /**
   * Which direction is positive for this metric.
   * - 'higher': up = green, down = red
   * - 'lower': up = red, down = green (e.g. churn rate, cost)
   * Defaults to 'higher'.
   */
  goodDirection?: 'higher' | 'lower';
  /** Unit appended directly after the numeric value, e.g. "%" or "pts". */
  unit?: string;
  /** When provided, the whole card becomes an anchor tag linking here. */
  href?: string;
  /** When true, renders a shimmering skeleton in place of content. */
  loading?: boolean;
  /** Additional class names for the root element. */
  className?: string;
}

function trendColor(
  trend: 'up' | 'down' | 'flat',
  goodDirection: 'higher' | 'lower',
): string {
  if (trend === 'flat') return 'var(--color-text-tertiary)';
  const isGood =
    (trend === 'up' && goodDirection === 'higher') ||
    (trend === 'down' && goodDirection === 'lower');
  return isGood ? 'var(--color-success)' : 'var(--color-danger)';
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: 'var(--radius-lg)',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  boxShadow: 'var(--shadow-raised)',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'box-shadow var(--duration-base) var(--ease-standard)',
};

const SKELETON_STYLE: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--color-background-secondary) 25%, var(--color-background-tertiary) 50%, var(--color-background-secondary) 75%)',
  backgroundSize: '200% 100%',
  animation: 'helm-shimmer 1.4s ease-in-out infinite',
  borderRadius: 'var(--radius-sm)',
};

export function KpiCard({
  label,
  value,
  delta,
  trend,
  goodDirection = 'higher',
  unit = '',
  href,
  loading = false,
  className,
}: KpiCardProps) {
  const isNull = value === null;
  const formattedValue = isNull
    ? '—'
    : typeof value === 'number'
    ? value.toLocaleString('en-US')
    : value;

  const deltaColor =
    trend ? trendColor(trend, goodDirection) : 'var(--color-text-tertiary)';

  const cardStyle: React.CSSProperties = {
    ...CARD_STYLE,
    cursor: href ? 'pointer' : 'default',
  };

  const inner = loading ? (
    <>
      <style>{`
        @keyframes helm-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <span style={{ ...SKELETON_STYLE, height: 10, width: '60%' }} />
      <span style={{ ...SKELETON_STYLE, height: 22, width: '80%', marginTop: 4 }} />
      <span style={{ ...SKELETON_STYLE, height: 9, width: '40%', marginTop: 2 }} />
    </>
  ) : (
    <>
      {/* Label */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-sans)',
        } as React.CSSProperties}
      >
        {label}
      </span>

      {/* Value */}
      <span
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: isNull ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
        } as React.CSSProperties}
      >
        {formattedValue}
        {!isNull && unit && (
          <span style={{ fontSize: 15, fontWeight: 500, opacity: 0.7 }}>{unit}</span>
        )}
        {isNull && (
          <span
            style={{
              display: 'block',
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: 'var(--color-text-tertiary)',
              marginTop: 2,
              opacity: 0.65,
            } as React.CSSProperties}
          >
            Not yet tracked
          </span>
        )}
      </span>

      {/* Delta */}
      {delta && !isNull && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: deltaColor,
            fontFamily: 'var(--font-sans)',
          } as React.CSSProperties}
        >
          {delta}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className} style={cardStyle}>
        {inner}
      </a>
    );
  }

  return (
    <div className={className} style={cardStyle}>
      {inner}
    </div>
  );
}
