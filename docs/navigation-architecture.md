# Navigation architecture (PropertyToolsAI & LeadSmart AI)

Shared implementation: **`@repo/ui`** (`PremiumSidebar`, `Sidebar`, `MobileSidebar`, `Topbar`, `CollapsibleNavGroup`) from **`packages/ui/navigation/`**, plus each app’s root **`nav.config.tsx`**. PropertyToolsAI and LeadSmart dashboard shells use **`PremiumSidebar`** (default-collapsed rail + tooltips). See **`docs/visual-navigation-structure.md`** for ASCII layouts.

## Principles

- **Goal-oriented IA**, not feature dumps: a few primary destinations, details inside collapsible groups.
- **One mental model per product**: consumer tools vs. agent operations.
- **Progressive disclosure**: collapsed groups by default except when the current route lives inside that group.
- **Responsive**: mobile drawer / overlay sidebar; top bar holds global actions.

---

## PropertyToolsAI (consumer, tool-first)

| Surface        | Role |
|----------------|------|
| **Top bar**    | Brand anchor, **search**, auth, **premium CTA** |
| **Sidebar**    | Wayfinding into tool clusters |

### Top bar

1. Logo → `/`
2. **Search** → submits to `/guides` with `?q=` (browse + discovery)
3. **Sign in** / **Sign up** (guest) via `AccessProvider`
4. **Unlock premium** → `/pricing` (or paywall)
5. **Account** menu (signed-in)

### Sidebar (collapsible groups)

| Group | Intent | Example destinations |
|-------|--------|----------------------|
| **Dashboard** | Agent hub (logged-in pros) | `/dashboard` |
| **Home Value** | “What’s it worth?” | Estimate, CMA, trends |
| **Financing** | Payments & qualification | Mortgage, affordability, refinance |
| **Investing** | Income & long-term holds | Cap rate, rental, rent vs buy |
| **AI Tools** | Assisted analysis | Compare, CMA AI, deal analyzer |
| **Recommended for You** | Discovery & trust | Guides, blog, pricing |

---

## LeadSmart AI (agent, CRM / conversion)

| Surface        | Role |
|----------------|------|
| **Top bar**    | **Search**, **notifications**, **credits / billing**, **profile** |
| **Sidebar**    | Daily workflow: pipeline work → intelligence → reporting → admin |

### Top bar

1. **Search** → quick jump to leads list with query (`/dashboard/leads`)
2. **Notifications** → `/dashboard/notifications`
3. **Credits / billing** → token readout + `/pricing`
4. **Profile** → settings, sign out

### Sidebar (collapsible groups)

| Primary | Maps to |
|---------|---------|
| Dashboard | `/dashboard/overview` |
| Leads | `/dashboard/leads` |
| Opportunities | `/dashboard/opportunities` |
| Pipeline | `/dashboard/contacts` (nurture / follow-up queue) |

| Collapsible: **AI tools** | Tool hub, comparison, presentations, marketing, automation |
| Collapsible: **Reports** | Reports, performance, properties, open houses, growth |
| **Settings** | `/dashboard/settings` (single link) |

*Note: “Pipeline” is modeled as **contacts** in this codebase; rename route later if you add a dedicated deals board.*

---

## Shared implementation patterns

- **`CollapsibleNavGroup`**: heading button toggles children; `aria-expanded`; chevron rotation.
- **`PremiumSidebar`**: desktop `md+`; default collapsed icon rail; hover tooltips; animated groups; `workspaceLabel` + optional `footer`.
- **`Sidebar`**: simpler desktop sidebar (no rail) — still available for legacy layouts.
- **`MobileSidebar`**: drawer + overlay; `md:hidden` in **`Topbar`**.
- **`Topbar`**: `appName` + `sections` (renders **`MobileSidebar`**), optional `leadingExtra`, default or `searchSlot` search, `rightActions`, `trailing`, `below`.
- **Auto-open**: collapsible group opens when it contains the active route.
