/**
 * RealtorNavConfig — Navigation configuration for RealtorSmart (the AI Operating System for Real Estate).
 * Import realtorNavConfig and spread it into the <Sidebar /> or <RealtorShell /> component.
 */

import type { NavSection, AiEmployeeBadge } from '@helm/ui';

export interface RealtorNavConfig {
  sections: NavSection[];
  aiEmployee: AiEmployeeBadge;
}

export const realtorNavConfig: RealtorNavConfig = {
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

    // ── Sales ────────────────────────────────────────────────────────────────
    {
      label: 'Sales',
      items: [
        {
          label: 'Leads',
          href: '/leads',
        },
        {
          label: 'Contacts',
          href: '/contacts',
        },
        {
          label: 'Pipeline',
          href: '/pipeline',
        },
        {
          label: 'Opportunities',
          href: '/opportunities',
        },
      ],
    },

    // ── Listings ─────────────────────────────────────────────────────────────
    {
      label: 'Listings',
      items: [
        {
          label: 'Properties',
          href: '/properties',
        },
        {
          label: 'Listings',
          href: '/listings',
        },
        {
          label: 'Open Houses',
          href: '/open-houses',
        },
        {
          label: 'CMA',
          href: '/cma',
        },
        {
          label: 'Showings',
          href: '/showings',
        },
      ],
    },

    // ── Marketing ────────────────────────────────────────────────────────────
    {
      label: 'Marketing',
      items: [
        {
          label: 'Campaigns',
          href: '/campaigns',
        },
        {
          label: 'Social',
          href: '/social',
        },
        {
          label: 'Reviews',
          href: '/reviews',
        },
      ],
    },

    // ── Operations ───────────────────────────────────────────────────────────
    {
      label: 'Operations',
      items: [
        {
          label: 'Tasks',
          href: '/tasks',
        },
        {
          label: 'Automation',
          href: '/automation',
        },
        {
          label: 'Playbooks',
          href: '/playbooks',
        },
        {
          label: 'Calendar',
          href: '/calendar',
        },
      ],
    },

    // ── Platform ─────────────────────────────────────────────────────────────
    {
      label: 'Platform',
      items: [
        {
          label: 'AI Receptionist',
          href: '/ai-receptionist',
        },
        {
          label: 'Settings',
          href: '/settings',
        },
        {
          label: 'Billing',
          href: '/billing',
        },
      ],
    },
  ],

  aiEmployee: {
    name: 'Emma, AI Receptionist',
    status: 'active',
  },
};
