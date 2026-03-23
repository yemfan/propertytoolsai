# `@repo/ui`

Shared UI for the monorepo.

## Navigation (App Router)

| File | Export |
|------|--------|
| `navigation/types.ts` | `NavConfig`, link/group types |
| `navigation/Sidebar.tsx` | Desktop sidebar |
| `navigation/PremiumSidebar.tsx` | Premium SaaS rail (default collapsed), tooltips, animated groups |
| `navigation/MobileSidebar.tsx` | Mobile drawer + overlay |
| `navigation/Topbar.tsx` | Top bar + mobile drawer + search/actions slots |
| `navigation/PremiumTopbar.tsx` | Glass bar + Lucide search/credits/bell/profile |
| `navigation/index.ts` | Public API (`@repo/ui`) |

**App paths in this repo**

| Your name | Actual folder |
|-----------|----------------|
| `apps/propertytoolsai` | `apps/property-tools` |
| `apps/leadsmartai` | `apps/leadsmart-ai` |

Nav config: `nav.config.tsx` at each app root. Shell: `components/AppShell.tsx`.
