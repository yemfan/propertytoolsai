# LeadSmart onboarding funnel

**Route:** `/onboarding`

High-conversion, step-based preview flow (local-first). Marketing CTAs for **agents** point here; completion links to `/agent-signup` (prefilled) and `/pricing`.

| Step | Purpose |
|------|---------|
| 1 | Lightweight signup (name + email) |
| 2 | Market setup: city, buyer/seller focus, price band |
| 3 | “Activation” simulation (typed log + pulse) |
| 4 | Demo inbox — realistic leads |
| 5 | Thread + reply (engagement) |
| 6 | Paywall / urgency **after** reply |
| 7 | Embedded plan summary → full `/pricing` |
| 8 | Upgrade: agent account + Stripe checkout entry |

**Persistence:** `localStorage` key `leadsmart_onboarding_v1` via `storage.ts`.

**Analytics:** Best-effort `POST /api/growth/track` with `event_type: onboarding_step` (requires Supabase `traffic_events`).

**Demo leads:** Generated in `demoLeads.ts` from profile + deterministic seed.
