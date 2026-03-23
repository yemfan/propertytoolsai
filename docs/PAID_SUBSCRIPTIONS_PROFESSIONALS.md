# Paid subscriptions — agents, brokers, and teams

PropertyTools AI and LeadSmart AI share one Supabase project. **Paid plans (Stripe)** are designed for real estate professionals.

## Who can subscribe?

Checkout is allowed when **any** of these is true:

1. **`user_profiles.role`** is a professional role, including:  
   `agent`, `broker`, `broker_owner`, `managing_broker`, `team_lead`, `brokerage_admin`, `owner`, `partner`, `admin`
2. The user has a row in **`agents`** (`auth_user_id` = Supabase user id), even if `role` is not set.
3. **Consumers** (`role` = `user`, etc.) may subscribe **unless** you set:

   ```bash
   ALLOW_CONSUMER_PAID_SUBSCRIPTIONS=false
   ```

   Default (unset or any value other than `false`) = **consumers can still subscribe** (backward compatible).

## Dashboard access

After login, users with a **professional role** (same list as above) or an **`agents`** row are sent into the app. **LeadSmart AI** routes by `user_profiles.role` to **`/admin`**, **`/broker`**, or **`/agent`** (see `apps/leadsmart-ai/lib/rolePortalPaths.ts`). **PropertyTools** sends pros to **`/dashboard`** (no separate role portals).

## Billing (Stripe Customer Portal)

**PropertyTools AI** does not expose a `/portal` page in the nav; **`/portal` redirects to `/dashboard`**. Stripe Billing Portal (`POST /api/stripe/portal`) uses `return_url` → `/dashboard`. Customer id is resolved from `agents.stripe_customer_id` or `user_profiles.stripe_customer_id`.

**LeadSmart AI** keeps **`/portal`** for **Stripe Customer Billing Portal** (account & invoices). Role portals link to it from hub pages; post-login home uses **`/admin`**, **`/broker`**, or **`/agent`**.

## Implementation

- `apps/property-tools/lib/paidSubscriptionEligibility.ts`
- `apps/leadsmart-ai/lib/paidSubscriptionEligibility.ts` (mirrored)
- `apps/leadsmart-ai/lib/rolePortalPaths.ts` — `getProfessionalPortalPath` (admin / broker / agent)
- `apps/leadsmart-ai/lib/rolePortalServer.ts` — session + profile context for gates and `/` redirect
- `apps/*/lib/stripeCustomerForUser.ts` — shared Stripe customer lookup
- Stripe: `POST /api/create-checkout-session` and `POST /api/stripe/checkout` (property-tools)
