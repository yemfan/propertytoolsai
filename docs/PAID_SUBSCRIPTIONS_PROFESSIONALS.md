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

After login, users with a **professional role** (same list as above) or an **`agents`** row are sent to the **agent dashboard** (same behavior as before, extended beyond `role === "agent"`).

## Billing portal (`/portal`)

After login, users with **`user_profiles.role`** in `agent`, `broker`, or `admin`, or anyone with an **`agents`** row, are redirected to **`/portal`** (unless `?redirect=` is set). The page shows plan status and opens **Stripe Customer Billing Portal** (`POST /api/stripe/portal`). Stripe `return_url` returns to `/portal`. Customer id is resolved from `agents.stripe_customer_id` or `user_profiles.stripe_customer_id`.

## Implementation

- `apps/property-tools/lib/paidSubscriptionEligibility.ts`
- `apps/leadsmart-ai/lib/paidSubscriptionEligibility.ts` (mirrored)
- `apps/*/lib/portalLanding.ts` — `shouldLandOnPortalAfterLogin`
- `apps/*/lib/stripeCustomerForUser.ts` — shared Stripe customer lookup
- Stripe: `POST /api/create-checkout-session` and `POST /api/stripe/checkout` (property-tools)
