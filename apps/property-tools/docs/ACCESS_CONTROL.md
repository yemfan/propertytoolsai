# Access control (Guest / Free / Premium)

## Modules

| File | Role |
|------|------|
| `lib/access.ts` | `resolveAccessTier`, `canUseTool`, `DEFAULT_LIMITS`, RPC tool mapping |
| `lib/usage.ts` | `getUsage()`, `incrementUsage()`, guest `localStorage` daily counters |
| `app/api/access/usage/route.ts` | `GET` — tier + usage for the signed-in user (or guest defaults) |
| `components/AuthModal.tsx` | Email/password login + signup (Supabase Auth) |
| `components/PaywallModal.tsx` | Premium upsell (links to `/pricing`) |
| `components/AccessProvider.tsx` | `useAccess()` — tier, `refresh`, `openAuth`, `openPaywall` |

## Tiers

- **Guest** — not signed in; daily limits enforced client-side (`localStorage` key `propertytoolsai:guest_tool_usage:v1`).
- **Free** — signed in; monthly limits for `estimator` / `cma` via Supabase `increment_usage` RPC (see `20260319_usage_limits.sql`).
- **Premium** — `subscription_status` in `active` / `trialing`, or `plan` in `premium` / `elite`.

## Usage in UI

```tsx
import { useAccess } from "@/components/AccessProvider";
import { canUseTool } from "@/lib/access";
import { getUsage } from "@/lib/usage";

const { tier, openAuth, openPaywall, refresh } = useAccess();
```

Combine `getUsage()` + `canUseTool({ tier, tool, used, limit })` before running an expensive tool action.
