/**
 * HelmNavConfig — Navigation configuration for HelmSmart (the AI Operating System for Business).
 * Import helmNavConfig and spread it into the <Sidebar /> or <HelmShell /> component.
 */

import type { NavSection, AiEmployeeBadge } from '@helm/ui';

export interface NavConfig {
  sections: NavSection[];
  aiEmployee: AiEmployeeBadge;
}

export const helmNavConfig: NavConfig = {
  sections: [
    // ── Top-level ────────────────────────────────────────────────────────────
    {
      items: [
        {
          label: 'Command Center',
          href: '/dashboard',
        },
      ],
    },

    // ── Business ─────────────────────────────────────────────────────────────
    {
      label: 'Business',
      items: [
        {
          label: 'Revenue',
          href: '/revenue',
        },
        {
          label: 'Marketing',
          href: '/marketing',
        },
        {
          label: 'Service',
          href: '/service',
        },
        {
          label: 'Operations',
          href: '/operations',
        },
      ],
    },

    // ── Finance & People ──────────────────────────────────────────────────────
    {
      label: 'Finance & People',
      items: [
        {
          label: 'Finance',
          href: '/finance',
        },
        {
          label: 'People',
          href: '/people',
        },
      ],
    },

    // ── Intelligence ──────────────────────────────────────────────────────────
    {
      label: 'Intelligence',
      items: [
        {
          label: 'Intelligence',
          href: '/intelligence',
        },
        {
          label: 'Knowledge',
          href: '/knowledge',
        },
      ],
    },

    // ── Platform ─────────────────────────────────────────────────────────────
    {
      label: 'Platform',
      items: [
        {
          label: 'Communication',
          href: '/communication',
        },
        {
          label: 'AI Workforce',
          href: '/ai-workforce',
        },
        {
          label: 'Settings',
          href: '/settings',
        },
      ],
    },
  ],

  aiEmployee: {
    name: 'Mark, AI COO',
    status: 'active',
  },
};
