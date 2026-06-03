/**
 * ListingCard — Property listing summary card for RealtorSmart.
 * Shows status badge, address, price, beds/baths/sqft, days on market,
 * and an optional agent note. Hover elevates the card.
 */

import React from 'react';
import { Bed, Bath, Square, Calendar, ExternalLink } from 'lucide-react';
import { Badge } from '@helm/ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListingStatus = 'active' | 'pending' | 'under-contract' | 'sold' | 'expired';

export interface ListingCardProps {
  /** MLS or internal listing id. */
  id: string;
  /** Street address. */
  address: string;
  /** City. */
  city: string;
  /** State abbreviation, e.g. "TX". */
  state: string;
  /** ZIP code. */
  zip?: string;
  /** Asking / sold price in whole dollars. */
  price: number;
  /** Number of bedrooms. */
  beds: number;
  /** Number of bathrooms. */
  baths: number;
  /** Total interior area in square feet. */
  sqft?: number;
  /** Current listing status. */
  status: ListingStatus;
  /** How many calendar days the property has been on the market. */
  daysOnMarket?: number;
  /** URL to the primary listing photo. */
  imageUrl?: string;
  /** MLS ID string for display. */
  mlsId?: string;
  /** Short note from the listing agent. */
  agentNote?: string;
  /** Click handler — makes the card interactive. */
  onClick?: () => void;
  /** Additional class names for the root element. */
  className?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const STATUS_CONFIG: Record<
  ListingStatus,
  { label: string; variant: BadgeVariant }
> = {
  active: { label: 'Active', variant: 'brand' },
  pending: { label: 'Pending', variant: 'warning' },
  'under-contract': { label: 'Under Contract', variant: 'warning' },
  sold: { label: 'Sold', variant: 'success' },
  expired: { label: 'Expired', variant: 'neutral' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ListingCard({
  address,
  city,
  state,
  zip,
  price,
  beds,
  baths,
  sqft,
  status,
  daysOnMarket,
  imageUrl,
  mlsId,
  agentNote,
  onClick,
  className,
}: ListingCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const isClickable = !!onClick;
  const cfg = STATUS_CONFIG[status];

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-background-primary)',
    border: '1px solid var(--color-border-tertiary)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: hovered && isClickable ? 'var(--shadow-floating)' : 'var(--shadow-raised)',
    transform: hovered && isClickable ? 'translateY(-2px)' : 'none',
    transition: `box-shadow var(--duration-base) var(--ease-standard),
                 transform var(--duration-base) var(--ease-standard)`,
    cursor: isClickable ? 'pointer' : 'default',
    display: 'flex',
    flexDirection: 'column',
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
      {/* Image */}
      {imageUrl ? (
        <div
          style={{
            height: 160,
            background: `url(${imageUrl}) center / cover no-repeat`,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <span style={{ position: 'absolute', top: 10, left: 10 }}>
            <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
          </span>
        </div>
      ) : (
        <div
          style={{
            height: 90,
            background: 'var(--color-background-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px',
            flexShrink: 0,
          } as React.CSSProperties}
        >
          <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
          {mlsId && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--color-text-tertiary)',
                fontFamily: 'Inter, system-ui, sans-serif',
              } as React.CSSProperties}
            >
              MLS# {mlsId}
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {/* Address */}
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.01em',
            } as React.CSSProperties}
          >
            {address}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              fontFamily: 'Inter, system-ui, sans-serif',
              marginTop: 1,
            } as React.CSSProperties}
          >
            {city}, {state}{zip ? ` ${zip}` : ''}
          </p>
        </div>

        {/* Price */}
        <p
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--brand)',
            letterSpacing: '-0.03em',
            fontFamily: 'Inter, system-ui, sans-serif',
          } as React.CSSProperties}
        >
          {formatCurrency(price)}
        </p>

        {/* Beds / baths / sqft */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={iconRowStyle}>
            <Bed size={13} /> <span>{beds} bd</span>
          </span>
          <span style={iconRowStyle}>
            <Bath size={13} /> <span>{baths} ba</span>
          </span>
          {sqft && (
            <span style={iconRowStyle}>
              <Square size={13} /> <span>{sqft.toLocaleString()} sqft</span>
            </span>
          )}
        </div>

        {/* Days on market */}
        {typeof daysOnMarket === 'number' && (
          <span style={iconRowStyle}>
            <Calendar size={12} />
            <span>
              {daysOnMarket === 0
                ? 'Listed today'
                : daysOnMarket === 1
                ? '1 day on market'
                : `${daysOnMarket} days on market`}
            </span>
          </span>
        )}

        {/* Agent note */}
        {agentNote && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontStyle: 'italic',
              lineHeight: 1.5,
              borderLeft: '2px solid var(--color-border-secondary)',
              paddingLeft: 8,
            } as React.CSSProperties}
          >
            {agentNote}
          </p>
        )}
      </div>
    </div>
  );
}

const iconRowStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  color: 'var(--color-text-secondary)',
  fontFamily: 'Inter, system-ui, sans-serif',
};
