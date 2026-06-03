/**
 * Sidebar — App navigation shell with logo, nav sections, and AI employee badge.
 * Background is always #080d18 (dark navy) regardless of product vertical.
 * Active state and AI badge use var(--brand) for per-vertical color theming.
 */

import React from 'react';
import { Wordmark } from './Wordmark';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  /** Display label. */
  label: string;
  /** Navigation href. */
  href: string;
  /** Icon node (Lucide or custom). */
  icon?: React.ReactNode;
  /** Optional numeric badge (e.g. unread count). */
  badge?: number;
}

export interface NavSection {
  /** Optional section heading text. */
  label?: string;
  /** Nav items in this section. */
  items: NavItem[];
}

export interface AiEmployeeBadge {
  /** Display name, e.g. "Mark, AI COO". */
  name: string;
  /** Activity status. */
  status?: 'active' | 'idle';
}

export interface SidebarProps {
  /** Product name shown in the wordmark, e.g. 'HelmSmart'. */
  productName: string;
  /** Letter shown in the logo mark, e.g. 'H', 'R'. */
  logoLetter: string;
  /** Ordered navigation sections. */
  sections: NavSection[];
  /** Href of the currently active route (matched to NavItem.href). */
  activeHref?: string;
  /** AI employee pill rendered at the bottom of the sidebar. */
  aiEmployee?: AiEmployeeBadge;
  /** Additional class names for the root element. */
  className?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavItemRow({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px 6px 14px',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: 13,
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#ffffff' : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
    background: isActive
      ? 'rgba(255,255,255,0.08)'
      : hovered
      ? 'rgba(255,255,255,0.04)'
      : 'transparent',
    borderLeft: isActive
      ? '2px solid var(--brand)'
      : '2px solid transparent',
    marginLeft: -2,
    transition: `color var(--duration-fast) var(--ease-standard),
                 background var(--duration-fast) var(--ease-standard)`,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
  };

  const iconStyle: React.CSSProperties = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    opacity: isActive ? 1 : 0.7,
    color: isActive ? 'var(--brand)' : 'inherit',
  };

  return (
    <a
      href={item.href}
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={isActive ? 'page' : undefined}
    >
      {item.icon && <span style={iconStyle}>{item.icon}</span>}
      <span style={{ flex: 1 }}>{item.label}</span>
      {typeof item.badge === 'number' && item.badge > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: 'var(--brand)',
            color: '#ffffff',
            borderRadius: 999,
            padding: '1px 5px',
            lineHeight: 1.5,
            minWidth: 16,
            textAlign: 'center',
          } as React.CSSProperties}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </a>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.28)',
        padding: '10px 14px 4px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      } as React.CSSProperties}
    >
      {label}
    </span>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  productName,
  logoLetter,
  sections,
  activeHref,
  aiEmployee,
  className,
}: SidebarProps) {
  return (
    <nav
      className={className}
      aria-label="Main navigation"
      style={{
        width: 180,
        minWidth: 180,
        maxWidth: 180,
        height: '100vh',
        background: '#080d18',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      } as React.CSSProperties}
    >
      {/* Logo area */}
      <div
        style={{
          padding: '18px 14px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <a href="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
          <Wordmark
            letter={logoLetter}
            productName={productName}
            size={24}
            variant="white"
          />
        </a>
      </div>

      {/* Nav sections */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 6px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        } as React.CSSProperties}
      >
        {sections.map((section, si) => (
          <div key={si}>
            {section.label && <SectionLabel label={section.label} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {section.items.map((item) => (
                <NavItemRow
                  key={item.href}
                  item={item}
                  isActive={activeHref === item.href}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* AI Employee badge */}
      {aiEmployee && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255,255,255,0.07)',
            } as React.CSSProperties}
          >
            {/* Pulsing dot */}
            <>
              <style>{`
                @keyframes helm-ai-pulse {
                  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 50%, transparent); }
                  50% { opacity: 0.8; box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 0%, transparent); }
                }
              `}</style>
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: aiEmployee.status === 'idle'
                    ? 'rgba(255,255,255,0.3)'
                    : 'var(--brand)',
                  flexShrink: 0,
                  animation: aiEmployee.status !== 'idle'
                    ? 'helm-ai-pulse 2s ease-in-out infinite'
                    : 'none',
                } as React.CSSProperties}
              />
            </>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.60)',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              } as React.CSSProperties}
            >
              {aiEmployee.name}
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
