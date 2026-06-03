/**
 * Card — Surface container with optional hover state and sub-components.
 * Sub-components: CardHeader, CardBody, CardFooter.
 */

import React from 'react';

const PADDING_MAP = {
  none: '0',
  sm: '12px',
  md: '20px',
  lg: '28px',
} as const;

export interface CardProps {
  /** Card content. */
  children: React.ReactNode;
  /** Additional class names for the root element. */
  className?: string;
  /** Inner padding preset. Defaults to 'md'. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** When true, applies a lift shadow + slight background shift on hover. */
  hover?: boolean;
  /** Makes the card interactive (pointer cursor, keyboard focusable). */
  onClick?: () => void;
}

export function Card({
  children,
  className,
  padding = 'md',
  hover = false,
  onClick,
}: CardProps) {
  const [hovered, setHovered] = React.useState(false);
  const isClickable = !!onClick;

  const style: React.CSSProperties = {
    background: 'var(--color-background-primary)',
    border: '1px solid var(--color-border-tertiary)',
    borderRadius: 'var(--radius-lg)',
    padding: PADDING_MAP[padding],
    boxShadow: (hover || isClickable) && hovered
      ? 'var(--shadow-floating)'
      : 'var(--shadow-raised)',
    transition: `box-shadow var(--duration-base) var(--ease-standard),
                 transform var(--duration-base) var(--ease-standard)`,
    transform: (hover || isClickable) && hovered ? 'translateY(-1px)' : 'none',
    cursor: isClickable ? 'pointer' : 'default',
    outline: 'none',
  };

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={className}
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {children}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  /** When true, adds a bottom border. Defaults to true. */
  bordered?: boolean;
}

export function CardHeader({ children, className, bordered = true }: CardHeaderProps) {
  return (
    <div
      className={className}
      style={{
        padding: '16px 20px',
        borderBottom: bordered ? '1px solid var(--color-border-tertiary)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function CardBody({ children, className, padding = 'md' }: CardBodyProps) {
  return (
    <div
      className={className}
      style={{ padding: PADDING_MAP[padding] } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
  /** When true, adds a top border. Defaults to true. */
  bordered?: boolean;
}

export function CardFooter({ children, className, bordered = true }: CardFooterProps) {
  return (
    <div
      className={className}
      style={{
        padding: '12px 20px',
        borderTop: bordered ? '1px solid var(--color-border-tertiary)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
