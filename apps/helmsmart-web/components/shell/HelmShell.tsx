/**
 * HelmShell — Full HelmSmart application shell.
 * Composes AppShell + Sidebar pre-configured for HelmSmart:
 * - Logo letter: 'H'
 * - Brand: #1E88E5 (set via data-pack="helm")
 * - Nav: helmNavConfig
 * - AI employee: Mark, AI COO
 *
 * Usage:
 *   <HelmShell activeHref="/revenue">
 *     <YourPageContent />
 *   </HelmShell>
 */

import React from 'react';
import { AppShell, Sidebar } from '@helm/ui';
import type { AiEmployeeBadge } from '@helm/ui';
import { helmNavConfig } from './HelmNavConfig';

export interface HelmShellProps {
  /** Page content rendered in the main scrollable area. */
  children: React.ReactNode;
  /** Href matched against nav items to highlight the active route. */
  activeHref?: string;
  /**
   * Override the default AI employee badge.
   * Defaults to { name: 'Mark, AI COO', status: 'active' }.
   */
  aiEmployee?: AiEmployeeBadge;
  /** Additional class names for the root element. */
  className?: string;
}

export function HelmShell({
  children,
  activeHref,
  aiEmployee,
  className,
}: HelmShellProps) {
  const resolvedAiEmployee = aiEmployee ?? helmNavConfig.aiEmployee;

  return (
    <div
      data-pack="helm"
      className={className}
      style={{ display: 'contents' } as React.CSSProperties}
    >
      <AppShell
        sidebar={
          <Sidebar
            productName="HelmSmart"
            logoLetter="H"
            sections={helmNavConfig.sections}
            activeHref={activeHref}
            aiEmployee={resolvedAiEmployee}
          />
        }
      >
        {children}
      </AppShell>
    </div>
  );
}
