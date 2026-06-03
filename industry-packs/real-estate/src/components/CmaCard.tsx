/**
 * CmaCard — Comparative Market Analysis summary card for RealtorSmart.
 * Shows the subject property, AI-suggested list price, price range bar,
 * and a comparables table with similarity scores.
 */

import React from 'react';
import { TrendingUp, Home, Calendar } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatFullCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function similarityColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 60) return 'var(--color-warning)';
  return 'var(--color-text-tertiary)';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CmaComparable {
  /** Street address of the comparable property. */
  address: string;
  /** ISO date string of when the property sold. */
  soldDate?: string;
  /** Sale price in whole dollars. */
  soldPrice: number;
  /** Number of bedrooms. */
  beds: number;
  /** Number of bathrooms. */
  baths: number;
  /** Total interior square footage. */
  sqft?: number;
  /** Price per square foot (computed or provided). */
  pricePerSqft?: number;
  /** AI-computed similarity score 0–100 vs. the subject property. */
  similarity?: number;
}

export interface CmaCardProps {
  /** Full address of the subject (target) property. */
  subjectAddress: string;
  /** AI-suggested optimal list price. */
  suggestedListPrice: number;
  /** Price range bracket. */
  priceRange: { low: number; high: number };
  /** Comparable sales used to generate the CMA. */
  comparables: CmaComparable[];
  /** ISO date string of when this CMA was generated. */
  generatedAt?: string;
  /** Additional class names for the root element. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CmaCard({
  subjectAddress,
  suggestedListPrice,
  priceRange,
  comparables,
  generatedAt,
  className,
}: CmaCardProps) {
  // Compute the suggested price position as % within the range for the bar
  const rangeSpan = priceRange.high - priceRange.low;
  const pricePercent = rangeSpan > 0
    ? Math.min(100, Math.max(0, ((suggestedListPrice - priceRange.low) / rangeSpan) * 100))
    : 50;

  return (
    <div
      className={className}
      style={{
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-raised)',
        fontFamily: 'Inter, system-ui, sans-serif',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div
        style={{
          background: 'color-mix(in srgb, var(--brand) 6%, var(--color-background-secondary))',
          borderBottom: '1px solid color-mix(in srgb, var(--brand) 15%, var(--color-border-tertiary))',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        } as React.CSSProperties}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} style={{ color: 'var(--brand)', flexShrink: 0 } as React.CSSProperties} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--brand)',
            } as React.CSSProperties}
          >
            Comparative Market Analysis
          </span>
          {generatedAt && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: 'var(--color-text-tertiary)',
              } as React.CSSProperties}
            >
              Generated {formatDate(generatedAt)}
            </span>
          )}
        </div>

        {/* Subject address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Home size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 } as React.CSSProperties} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            } as React.CSSProperties}
          >
            {subjectAddress}
          </span>
        </div>

        {/* Suggested price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: 'var(--brand)',
            } as React.CSSProperties}
          >
            {formatFullCurrency(suggestedListPrice)}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-tertiary)',
              fontWeight: 500,
            } as React.CSSProperties}
          >
            suggested list price
          </span>
        </div>

        {/* Price range bar */}
        <div>
          <div
            style={{
              position: 'relative',
              height: 6,
              background: 'var(--color-background-tertiary)',
              borderRadius: 999,
              overflow: 'visible',
            } as React.CSSProperties}
          >
            {/* Filled portion */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${pricePercent}%`,
                background: 'color-mix(in srgb, var(--brand) 40%, var(--color-background-tertiary))',
                borderRadius: 999,
              } as React.CSSProperties}
            />
            {/* Suggested price marker */}
            <div
              style={{
                position: 'absolute',
                top: -4,
                left: `${pricePercent}%`,
                transform: 'translateX(-50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'var(--brand)',
                border: '2px solid var(--color-background-primary)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
              } as React.CSSProperties}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: 'var(--color-text-tertiary)',
                fontWeight: 500,
              } as React.CSSProperties}
            >
              {formatCurrency(priceRange.low)} low
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--color-text-tertiary)',
                fontWeight: 500,
              } as React.CSSProperties}
            >
              {formatCurrency(priceRange.high)} high
            </span>
          </div>
        </div>
      </div>

      {/* Comparables table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            color: 'var(--color-text-primary)',
          } as React.CSSProperties}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-secondary)',
              }}
            >
              {['Address', 'Sold Date', 'Price', 'Bd/Ba', '$/sqft', 'Match'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 16px',
                    textAlign: 'left',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                    whiteSpace: 'nowrap',
                  } as React.CSSProperties}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparables.map((comp, i) => (
              <tr
                key={i}
                style={{
                  borderBottom:
                    i < comparables.length - 1
                      ? '1px solid var(--color-border-tertiary)'
                      : 'none',
                }}
              >
                {/* Address */}
                <td
                  style={{
                    padding: '10px 16px',
                    fontWeight: 500,
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  } as React.CSSProperties}
                >
                  {comp.address}
                </td>

                {/* Sold date */}
                <td
                  style={{
                    padding: '10px 16px',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  } as React.CSSProperties}
                >
                  {comp.soldDate ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} />
                      {formatDate(comp.soldDate)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>

                {/* Price */}
                <td
                  style={{
                    padding: '10px 16px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  } as React.CSSProperties}
                >
                  {formatFullCurrency(comp.soldPrice)}
                </td>

                {/* Beds/Baths */}
                <td
                  style={{
                    padding: '10px 16px',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  } as React.CSSProperties}
                >
                  {comp.beds}bd / {comp.baths}ba
                </td>

                {/* Price per sqft */}
                <td
                  style={{
                    padding: '10px 16px',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  } as React.CSSProperties}
                >
                  {comp.pricePerSqft
                    ? `$${Math.round(comp.pricePerSqft).toLocaleString()}`
                    : comp.sqft && comp.soldPrice
                    ? `$${Math.round(comp.soldPrice / comp.sqft).toLocaleString()}`
                    : '—'}
                </td>

                {/* Similarity score */}
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                  {typeof comp.similarity === 'number' ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: similarityColor(comp.similarity),
                        background:
                          comp.similarity >= 80
                            ? 'var(--color-success-bg)'
                            : comp.similarity >= 60
                            ? 'var(--color-warning-bg)'
                            : 'var(--color-background-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 7px',
                      } as React.CSSProperties}
                    >
                      {comp.similarity}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
