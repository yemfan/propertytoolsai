# `@repo/ui` — navigation

Shared **Next.js App Router** chrome for PropertyTools AI (`apps/propertytoolsai`) and LeadSmart AI (`apps/leadsmartai`).

**Visual language:** cool **slate** neutrals, subtle **hairline** borders (`slate-200/90`), soft **elevation** (shadows + `ring-1` tints), **uppercase tracking** on micro-labels, and **backdrop blur / saturate** on sticky bars for a calm, premium SaaS feel (Nord-adjacent, not theme-dependent).

## Modules

| Export | Role |
|--------|------|
| `types` | `NavSection`, `NavLeafItem`, `NavGroupItem`, `NavConfig`, `isNavGroup` |
| `matchPath` | `isLinkActive` (supports `match[]`, prefix rules) |
| `PremiumSidebar` | Desktop `md+` collapsed rail, tooltips, chevron groups (collapsible), optional `defaultOpen` on `NavGroupItem` |
| `MobileSidebar` | Hamburger + drawer, body scroll lock, Escape |
| `Topbar` | Sticky bar with `MobileSidebar`, search slot, actions, `trailing` |
| `PremiumTopbar` | Glass bar + optional credits, bell, `ProfileMenu` |
| `ProfileMenu` | Avatar dropdown (profile/settings/billing/log out) |

Apps own **`nav.config.tsx`** (and LeadSmart **`marketing.nav.config.tsx`**) that build `NavSection[]` with **lucide-react** icons.

## Usage

```tsx
import { PremiumSidebar, Topbar } from "@repo/ui";
import navConfig, { propertyToolsNav } from "@/nav.config";

<PremiumSidebar
  appName="PropertyTools AI"
  sections={propertyToolsNav}
  defaultCollapsed
  workspaceLabel={navConfig.sidebarTitle ?? "Tools"}
  footer={…}
/>
<Topbar appName="…" sections={propertyToolsNav} searchPlaceholder="…" trailing={…} />
```

## `NavLeafItem.prefetch`

Set `prefetch: false` on links that must not trigger Next prefetch (e.g. dashboard entry from a marketing shell before auth).

Public API: `packages/ui/navigation/index.ts`.
