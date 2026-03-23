# Role-based access (Property Tools)

Canonical roles live in **`public.profiles.role`**:

`admin` · `agent` · `loan_broker` · `support` · `consumer`

## Database

- Migrations under `apps/property-tools/supabase/migrations/` (and mirrored in `apps/leadsmart-ai/`):
  - `20260315000000_create_profiles_table.sql` — table
  - `20260316000000_profiles_updated_at_trigger.sql` — `updated_at` trigger
  - `20260317000000_profiles_rbac_rls_auth_trigger.sql` — role check, RLS, **`auth.users` → `public.profiles` trigger**
- After signup, Supabase inserts `auth.users`; the trigger inserts a matching `profiles` row (`role = consumer`).

## App code (`apps/property-tools`)

| Piece | Purpose |
|--------|---------|
| `lib/auth/roles.ts` | `UserRole` union + helpers |
| `lib/auth/getCurrentUser.ts` | Server: Supabase user + `profiles` (fallback: legacy `user_profiles`) |
| `lib/auth/requireRole.ts` | Server guard for pages / layouts |
| `lib/auth/navByRole.tsx` | Role-based sidebar sections |
| `proxy.ts` | Session refresh + redirect unauthenticated users away from `/dashboard-router` and `/rbac/*` |
| `app/dashboard-router/page.tsx` | Post-login hub; redirects by role or `?redirect=` |
| `app/unauthorized/page.tsx` | 403-style page; `requireRole()` redirects here by default |
| `app/admin/platform-overview`, `app/agent/dashboard`, … | Role landing pages (see `dashboard-router`) |
| `app/rbac/*/page.tsx` | Legacy demo routes (optional) |

## Client API

`GET /api/auth/profile` — JSON `{ id, email, full_name, role }` for the current session (401 if logged out). Used by `AppShell` for the sidebar.

## Promoting users

Update **`public.profiles.role`** in SQL (or an admin tool) for a given `id` (`auth.users.id`). Only staff/service role should change roles in production.
