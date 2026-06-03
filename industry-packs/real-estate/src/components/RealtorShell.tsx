/**
 * RealtorShell — Full RealtorSmart application shell.
 * Composes AppShell + Sidebar pre-configured for RealtorSmart:
 * - Logo letter: 'R'
 * - Brand: #4F46E5 (set via data-pack="real-estate")
 * - Nav: realtorNavConfig
 * - AI employee: Emma, AI Receptionist
 *
 * Usage:
 *   <RealtorShell activeHref="/leads">
 *     <YourPageContent />
 *   </RealtorShell>
 */

import React from 'react';
import { AppShell, Sidebar } from '@helm/ui';
import type { AiEmployeeBadge } from '@helm/ui';
import { realtorNavConfig } from './RealtorNavConfig';

export interface RealtorShellProps {
  /** Page content rendered in the main scrollable area. */
  children: React.ReactNode;
  /** Href matched against nav items to highlight the active route. */
  activeHref?: string;
  /**
   * Override the default AI employee badge.
   * Defaults to { name: 'Emma, AI Receptionist', status: 'active' }.
   */
  aiEmployee?: AiEmployeeBadge;
  /** Additional class names for the root element. */
  className?: string;
}

export function RealtorShell({
  children,
  activeHref,
  aiEmployee,
  className,
}: RealtorShellProps) {
  const resolvedAiEmployee = aiEmployee ?? realtorNavConfig.aiEmployee;

  return (
    <div
      data-pack="real-estate"
      className={className}
      style={{ display: 'contents' } as React.CSSProperties}
    >
      <AppShell
        sidebar={
          <Sidebar
            productName="RealtorSmart"
            logoLetter="R"
            sections={realtorNavConfig.sections}
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
