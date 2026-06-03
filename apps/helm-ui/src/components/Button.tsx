/**
 * Button — Multi-variant interactive button with optional icons and loading state.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style:
   * - 'primary': filled brand background
   * - 'secondary': bordered brand
   * - 'ghost': transparent, brand text on hover
   * - 'destructive': filled red
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  /** Size preset controlling padding and font size. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** When true, renders a spinner and disables the button. */
  loading?: boolean;
  /** Icon node rendered to the left of the label. */
  leftIcon?: React.ReactNode;
  /** Icon node rendered to the right of the label. */
  rightIcon?: React.ReactNode;
  /**
   * When true, the button renders without its own chrome so a child component
   * (e.g. a Next.js <Link>) can provide the element. The child must forward refs.
   * Note: variant/size styles are still applied via className.
   */
  asChild?: boolean;
  /** Additional class names. */
  className?: string;
}

const SIZE_STYLES: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: { fontSize: 12, padding: '5px 12px', gap: 5, borderRadius: 'var(--radius-sm)' },
  md: { fontSize: 14, padding: '8px 16px', gap: 6, borderRadius: 'var(--radius-md)' },
  lg: { fontSize: 15, padding: '11px 20px', gap: 8, borderRadius: 'var(--radius-lg)' },
};

function getVariantStyle(
  variant: NonNullable<ButtonProps['variant']>,
  isHovered: boolean,
  isPressed: boolean,
): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: isPressed
          ? 'color-mix(in srgb, var(--brand) 80%, #000)'
          : isHovered
          ? 'color-mix(in srgb, var(--brand) 88%, #000)'
          : 'var(--brand)',
        color: '#ffffff',
        border: '1px solid transparent',
        boxShadow: isHovered ? 'var(--shadow-raised)' : 'none',
      };
    case 'secondary':
      return {
        background: isHovered
          ? 'color-mix(in srgb, var(--brand) 8%, transparent)'
          : 'transparent',
        color: 'var(--brand)',
        border: '1px solid var(--brand)',
      };
    case 'ghost':
      return {
        background: isHovered
          ? 'color-mix(in srgb, var(--brand) 8%, transparent)'
          : 'transparent',
        color: isHovered ? 'var(--brand)' : 'var(--color-text-secondary)',
        border: '1px solid transparent',
      };
    case 'destructive':
      return {
        background: isPressed ? '#b91c1c' : isHovered ? '#ef4444' : '#dc2626',
        color: '#ffffff',
        border: '1px solid transparent',
        boxShadow: isHovered ? 'var(--shadow-raised)' : 'none',
      };
  }
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  asChild = false,
  className,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const isDisabled = disabled || loading;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    lineHeight: 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.55 : 1,
    transition: `background var(--duration-fast) var(--ease-standard),
                 box-shadow var(--duration-fast) var(--ease-standard),
                 opacity var(--duration-fast) var(--ease-standard)`,
    outline: 'none',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    ...SIZE_STYLES[size],
    ...getVariantStyle(variant, hovered && !isDisabled, pressed && !isDisabled),
    ...style,
  };

  const iconSize = size === 'sm' ? 13 : size === 'md' ? 15 : 17;

  const content = (
    <>
      {loading && (
        <Loader2
          size={iconSize}
          style={{
            animation: 'helm-spin 0.75s linear infinite',
            flexShrink: 0,
          }}
        />
      )}
      {!loading && leftIcon && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && rightIcon && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{rightIcon}</span>
      )}
    </>
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      style: { ...baseStyle, ...(children.props as React.HTMLAttributes<HTMLElement>).style },
      className,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => { setHovered(false); setPressed(false); },
      onMouseDown: () => setPressed(true),
      onMouseUp: () => setPressed(false),
    });
  }

  return (
    <>
      <style>{`
        @keyframes helm-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <button
        {...rest}
        disabled={isDisabled}
        className={className}
        style={baseStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
      >
        {content}
      </button>
    </>
  );
}
