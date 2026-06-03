/**
 * LeadCard — Lead summary card for RealtorSmart.
 * Displays name, stage badge, lead score, contact info, source, last contact,
 * property interest, and an optional AI SDR note.
 */

import React from 'react';
import { Mail, Phone, Clock, Home, Zap } from 'lucide-react';
import { Badge, LogoMark } from '@helm/ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string as a relative human-readable string.
 * - < 1h → "Xm ago"
 * - < 24h → "Xh ago"
 * - < 7 days → "X days ago"
 * - older → "Jan 15" or "Jan 15, 2024"
 */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'var(--color-success-bg)';
  if (score >= 50) return 'var(--color-warning-bg)';
  return 'var(--color-danger-bg)';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadCardProps {
  /** Internal lead id. */
  id: string;
  /** Lead full name. */
  name: string;
  /** Email address. */
  email?: string;
  /** Phone number. */
  phone?: string;
  /** Lead score 0–100. */
  score?: number;
  /**
   * Current pipeline stage.
   * e.g. 'New Lead' | 'Contacted' | 'Qualified' | 'Appointment Set' | 'Active Client'
   */
  stage: string;
  /**
   * Lead source.
   * e.g. 'Zillow' | 'Website' | 'Referral' | 'Open House'
   */
  source?: string;
  /** ISO date string of the last contact attempt or interaction. */
  lastContact?: string;
  /** Short description of what the lead is looking for. */
  propertyInterest?: string;
  /** Most recent action or recommendation from the AI SDR (Emma). */
  aiNote?: string;
  /** Click handler — makes the card interactive. */
  onClick?: () => void;
  /** Additional class names for the root element. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadCard({
  name,
  email,
  phone,
  score,
  stage,
  source,
  lastContact,
  propertyInterest,
  aiNote,
  onClick,
  className,
}: LeadCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const isClickable = !!onClick;

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-background-primary)',
    border: '1px solid var(--color-border-tertiary)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: hovered && isClickable ? 'var(--shadow-floating)' : 'var(--shadow-raised)',
    transform: hovered && isClickable ? 'translateY(-1px)' : 'none',
    transition: `box-shadow var(--duration-base) var(--ease-standard),
                 transform var(--duration-base) var(--ease-standard)`,
    cursor: isClickable ? 'pointer' : 'default',
  };

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={className}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* Header: name + stage + score */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            } as React.CSSProperties}
          >
            {name}
          </p>
        </div>
        <Badge variant="neutral" size="sm">{stage}</Badge>
        {typeof score === 'number' && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: scoreColor(score),
              background: scoreBg(score),
              borderRadius: 'var(--radius-sm)',
              padding: '2px 7px',
              fontFamily: 'Inter, system-ui, sans-serif',
              flexShrink: 0,
            } as React.CSSProperties}
          >
            {score}
          </span>
        )}
      </div>

      {/* Contact info */}
      {(email || phone) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {email && (
            <span style={contactRowStyle}>
              <Mail size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </span>
            </span>
          )}
          {phone && (
            <span style={contactRowStyle}>
              <Phone size={12} />
              <span>{phone}</span>
            </span>
          )}
        </div>
      )}

      {/* Source + last contact row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {source && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--brand)',
              background: 'color-mix(in srgb, var(--brand) 10%, transparent)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 7px',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '0.03em',
            } as React.CSSProperties}
          >
            {source}
          </span>
        )}
        {lastContact && (
          <span style={contactRowStyle}>
            <Clock size={11} />
            <span>{formatRelativeDate(lastContact)}</span>
          </span>
        )}
      </div>

      {/* Property interest */}
      {propertyInterest && (
        <span style={contactRowStyle}>
          <Home size={12} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {propertyInterest}
          </span>
        </span>
      )}

      {/* AI note */}
      {aiNote && (
        <div
          style={{
            display: 'flex',
            gap: 7,
            alignItems: 'flex-start',
            padding: '8px 10px',
            background: 'color-mix(in srgb, var(--brand) 5%, var(--color-background-primary))',
            border: '1px solid color-mix(in srgb, var(--brand) 18%, var(--color-border-tertiary))',
            borderRadius: 'var(--radius-md)',
          } as React.CSSProperties}
        >
          <LogoMark letter="R" size={14} />
          <p
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.55,
              color: 'var(--color-text-secondary)',
              fontFamily: 'Inter, system-ui, sans-serif',
              flex: 1,
            } as React.CSSProperties}
          >
            {aiNote}
          </p>
        </div>
      )}
    </div>
  );
}

const contactRowStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  color: 'var(--color-text-secondary)',
  fontFamily: 'Inter, system-ui, sans-serif',
  overflow: 'hidden',
};
