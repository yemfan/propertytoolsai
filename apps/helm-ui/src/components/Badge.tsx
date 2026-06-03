/**
 * Badge — Compact inline status / label chip.
 * Variants: brand, success, warning, danger, neutral, ai (brand + pulse dot).
 */

import React from 'react';

export interface BadgeProps {
  /** Badge label content. */
  children: React.ReactNode;
  /**
   * Color theme:
   * - 'brand': uses var(--brand) background, white text
   * - 'ai': brand background + pulsing activity dot
   * - 'success' | 'warning' | 'danger': semantic status colors
   * - 'neutral': muted gray
   */
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'ai';
  /** Size preset. Defaults to 'md'. */
  size?: 'sm' | 'md';
  /** Renders a small colored dot before the text. Overridden to true for 'ai' variant. */
  dot?: boolean;
  /** Additional class names. */
  className?: string;
}

const VARIANT_STYLES: Record<
  NonNullable<BadgeProps['variant']>,
  { bg: string; color: string; dotColor: string }
> = {
  brand: {
    bg: 'var(--brand)',
    color: '#ffffff',
    dotColor: 'rgba(255,255,255,0.8)',
  },
  ai: {
    bg: 'var(--brand)',
    color: '#ffffff',
    dotColor: '#ffffff',
  },
  success: {
    bg: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    dotColor: 'var(--color-success)',
  },
  warning: {
    bg: 'var(--color-warning-bg)',
    color: 'var(--color-warning)',
    dotColor: 'var(--color-warning)',
  },
  danger: {
    bg: 'var(--color-danger-bg)',
    color: 'var(--color-danger)',
    dotColor: 'var(--color-danger)',
  },
  neutral: {
    bg: 'var(--color-background-tertiary)',
    color: 'var(--color-text-secondary)',
    dotColor: 'var(--color-text-tertiary)',
  },
};

const SIZE_STYLES: Record<NonNullable<BadgeProps['size']>, React.CSSProperties> = {
  sm: { fontSize: 10, padding: '2px 6px', gap: 4, borderRadius: 'var(--radius-sm)' },
  md: { fontSize: 11, padding: '3px 8px', gap: 5, borderRadius: 'var(--radius-sm)' },
};

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot,
  className,
}: BadgeProps) {
  const isAi = variant === 'ai';
  const showDot = dot || isAi;
  const theme = VARIANT_STYLES[variant];

  const dotEl = showDot ? (
    <>
      <style>{`
        @keyframes helm-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: size === 'sm' ? 5 : 6,
          height: size === 'sm' ? 5 : 6,
          borderRadius: '50%',
          background: theme.dotColor,
          flexShrink: 0,
          animation: isAi ? 'helm-pulse 1.5s ease-in-out infinite' : 'none',
        } as React.CSSProperties}
      />
    </>
  ) : null;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1,
        background: theme.bg,
        color: theme.color,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...SIZE_STYLES[size],
      } as React.CSSProperties}
    >
      {dotEl}
      {children}
    </span>
  );
}
