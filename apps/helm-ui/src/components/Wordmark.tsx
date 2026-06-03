/**
 * Wordmark — LogoMark + product name lockup.
 * Renders the node-ring mark alongside the product name with ".ai" suffix in brand color.
 */

import { LogoMark } from './LogoMark';

export interface WordmarkProps {
  /** The letter to display in the logo mark. Defaults to 'H'. */
  letter?: string;
  /** The product name displayed next to the mark. Defaults to 'HelmSmart'. */
  productName?: string;
  /** Mark size in pixels. Text scales proportionally. Defaults to 32. */
  size?: number;
  /**
   * Visual variant:
   * - 'color': dark/brand text (for light backgrounds)
   * - 'white': all white (for dark backgrounds like the sidebar)
   */
  variant?: 'color' | 'white';
  /** Additional class names applied to the root container element. */
  className?: string;
}

export function Wordmark({
  letter = 'H',
  productName = 'HelmSmart',
  size = 32,
  variant = 'color',
  className,
}: WordmarkProps) {
  const isWhite = variant === 'white';

  const markColor = isWhite ? '#ffffff' : 'var(--brand)';
  const nameColor = isWhite ? '#ffffff' : 'var(--color-text-primary)';
  const aiColor = isWhite ? 'rgba(255,255,255,0.70)' : 'var(--brand)';

  // Font size scales with mark size
  const fontSize = Math.round(size * 0.5);
  const lineHeight = size;

  // Strip a trailing ".ai" from the product name if the user already included it,
  // so we can render the suffix consistently with the brand color.
  const baseName = productName.replace(/\.ai$/i, '');

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.28),
        userSelect: 'none',
        textDecoration: 'none',
      } as React.CSSProperties}
    >
      <LogoMark letter={letter} color={markColor} size={size} />

      <span
        style={{
          fontSize,
          lineHeight: `${lineHeight}px`,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: nameColor,
          whiteSpace: 'nowrap',
        } as React.CSSProperties}
      >
        {baseName}
        <span style={{ color: aiColor, fontWeight: 400 }}>.ai</span>
      </span>
    </div>
  );
}
