# `@repo/ui`

Shared UI for the monorepo.

## Navigation (App Router)

| File | Export |
|------|--------|
| `navigation/types.ts` | `NavConfig`, link/group types |
| `navigation/Sidebar.tsx` | Desktop sidebar |
| `navigation/PremiumSidebar.tsx` | Premium SaaS rail (`defaultCollapsed`), gray palette, simple tooltips, `+`/`−` groups, ←/→ header, ✦ collapsed footer; nav icons from each app’s `nav.config` + `lucide-react` |
| `navigation/MobileSidebar.tsx` | Mobile drawer + overlay |
| `navigation/Topbar.tsx` | Top bar + mobile drawer + search/actions slots |
| `navigation/PremiumTopbar.tsx` | Glass bar + Lucide search/credits/bell/profile menu or chip |
| `navigation/ProfileMenu.tsx` | Avatar dropdown (optional profile/settings/billing/log out) |
| `navigation/index.ts` | Public API (`@repo/ui`) |

**App paths in this repo**

| Folder |
|--------|
| `apps/propertytoolsai` |
| `apps/leadsmartai` |

Nav config: `nav.config.tsx` at each app root; LeadSmart AI also uses `marketing.nav.config.tsx` for the public tools shell. Shell: `components/AppShell.tsx`. Details: **`navigation/README.md`**.
