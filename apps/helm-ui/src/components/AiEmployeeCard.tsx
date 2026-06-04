/**
 * AiEmployeeCard — Briefing card surfacing an AI Employee's current status and quick actions.
 * Background and border are brand-tinted to visually distinguish AI content from standard cards.
 */

import React from 'react';
import { LogoMark } from './LogoMark';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';

export interface AiAction {
  /** Button label. */
  label: string;
  /** Navigation href (renders an anchor). */
  href?: string;
  /** Click handler (used when no href). */
  onClick?: () => void;
}

export interface AiEmployeeCardProps {
  /** Full display name, e.g. "Emma, AI Receptionist". */
  employeeName: string;
  /**
   * Letter shown in the mini LogoMark inside the card.
   * Should correspond to the product vertical ('H', 'R', 'D', etc.).
   */
  logoLetter?: string;
  /** Persona avatar id (e.g. "persona-03"). When set, shown instead of the LogoMark. */
  avatar?: string;
  /** The AI's current briefing message displayed in the card body. */
  message: string;
  /** Quick action buttons rendered at the bottom. */
  actions?: AiAction[];
  /**
   * Current AI status:
   * - 'active': pulsing badge
   * - 'thinking': animated dots
   * - 'idle': muted neutral badge
   */
  status?: 'active' | 'thinking' | 'idle';
  /** Additional class names for the root element. */
  className?: string;
}

function StatusBadge({ status }: { status: AiEmployeeCardProps['status'] }) {
  if (status === 'idle') return <Badge variant="neutral" size="sm">Idle</Badge>;
  if (status === 'thinking') return <Badge variant="ai" size="sm" dot>Thinking…</Badge>;
  return <Badge variant="ai" size="sm" dot>Active</Badge>;
}

export function AiEmployeeCard({
  employeeName,
  logoLetter = 'H',
  avatar,
  message,
  actions = [],
  status = 'active',
  className,
}: AiEmployeeCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'color-mix(in srgb, var(--brand) 6%, var(--color-background-primary))',
        border: '1px solid color-mix(in srgb, var(--brand) 22%, var(--color-border-tertiary))',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: 'var(--shadow-raised)',
      } as React.CSSProperties}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {avatar ? <Avatar id={avatar} size={24} alt={employeeName} /> : <LogoMark letter={logoLetter} size={20} />}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            flex: 1,
            letterSpacing: '-0.01em',
          } as React.CSSProperties}
        >
          {employeeName}
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Message */}
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          margin: 0,
        } as React.CSSProperties}
      >
        {message}
      </p>

      {/* Actions */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {actions.map((action, i) =>
            action.href ? (
              <a
                key={i}
                href={action.href}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--brand)',
                  background: 'color-mix(in srgb, var(--brand) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background var(--duration-fast) var(--ease-standard)',
                } as React.CSSProperties}
              >
                {action.label}
              </a>
            ) : (
              <Button
                key={i}
                variant="secondary"
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
