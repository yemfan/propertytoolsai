# User roles (`user_profiles.role`)

Shared Supabase `user_profiles.role` drives **LeadSmart AI** routing and **PropertyTools AI** premium access.

| Role | Typical use |
|------|-------------|
| `user` | Consumer / end-user (default after signup). |
| `agent` | Individual agent — CRM dashboard at `/dashboard/overview`. |
| `broker` | Brokerage leadership — broker dashboard at `/dashboard/broker`. |
| `support` | Platform support — inbox at `/admin/support` (with `admin`). |
| `admin` | Platform admin — `/admin/support` and admin hub. |
| `broker_owner`, `managing_broker`, `team_lead`, `brokerage_admin`, `owner`, `partner` | Brokerage org roles — same broker dashboard + CRM as `broker`. |

## Post-login home (LeadSmart AI)

Resolved by `resolveRoleHomePath()` in `lib/rolePortalPaths.ts`:

- **Admin / support** → `/admin/support`
- **Broker family** (see `BROKER_PORTAL_ROLES`) → `/dashboard/broker`
- **Agent (and other pros)** → `/dashboard/overview`

## Applying roles

Update in Supabase (SQL) or your admin tooling:

```sql
update public.user_profiles
set role = 'support'
where user_id = '<uuid>';
```

After migration `20260320000000_user_profiles_role_broker_support.sql`, the column has a **comment** documenting allowed values (Postgres does not enforce an enum for this column).
