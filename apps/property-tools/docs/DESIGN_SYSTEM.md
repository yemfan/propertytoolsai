# PropertyTools AI — UI design system

Shared with **LeadSmart AI** for a consistent family look: same brand blues (`#0072ce` / `#005ca8`), success green, and accent orange via `app/globals.css` (`@theme` + `:root`).

## Brand checkmarks (`components/brand/BrandCheck.tsx`)

Colored circular ✓ chips using **primary**, **primaryDark**, **success**, and **accent** (`BRAND` constant). Use for bullet lists (hero trust, pipeline, pricing features). For long lists, `toneAt(index)` cycles tones. **LeadSmart AI** uses the same component under `apps/leadsmart-ai/components/brand/BrandCheck.tsx`.

## Feature highlight cards (`components/ui/FeatureHighlightCard.tsx`)

Top **4px brand accent** + **gradient** into `slate-50` — same pattern as LeadSmart **“Close More Deals with Less Work”** (`#features`). Props: `accent` (`primary` | `primaryDark` | `success` | `accent`), `title`, `description`. Used on the **homepage** (“Make Smarter Decisions with AI”) and **pricing** value-prop row.

## Surfaces (`components/ui/Card.tsx`)

| Variant       | Use |
|---------------|-----|
| `default`     | Primary panels — border `slate-200/90`, soft ring + shadow. |
| `interactive` | Clickable tiles / links — hover lift + brand border tint. |
| `muted`       | Secondary blocks (testimonials, stats strips). |
| `flat` / `inset` | Lighter or nested panels. |

## Layout helpers

- **`AuthPageShell`** — login, signup, agent signup (radial brand glow + gradient).
- **`MarketingContentLayout`** — legal / simple content pages in a card on a gradient.
- **`ToolPageScaffold`** — two-column tool UIs with `Section` headers.
- **`AppLayout`** — app shell uses a subtle `bg-gradient-to-br` (not flat gray).

## Typography

- Headings: `font-heading` (Montserrat).
- Body: `font-body` / default body (Roboto).
- Section titles: `Section` supports optional `eyebrow` in brand color.

## Consistency checklist for new pages

1. Page background: gradient or `bg-white`, not raw `gray-50` unless intentional.
2. Primary actions: `Button` default (brand blue), not ad-hoc `blue-600`.
3. Cards: use `Card` + variants instead of one-off `border rounded-xl bg-white`.
4. Links: `text-[#0072ce]` hover `#005ca8` (see `globals.css` `a` rules).
