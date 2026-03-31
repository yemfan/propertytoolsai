# Onboarding → activation → upgrade funnel

LeadSmart AI tracks **activation**, **AI usage caps** for free/starter, **upgrade prompts** tied to billing, **push** (hot leads already wired; reminders added), and **funnel analytics** rows.

## Schema

Migration: `supabase/migrations/20260466000000_leadsmart_funnel.sql`

| Object | Purpose |
|--------|---------|
| `leadsmart_funnel_state` | `onboarding_completed_at`, `first_reply_at`, `first_ai_usage_at`, monthly `ai_usage_count` / `ai_usage_month`, `last_upgrade_prompt_at` (modal throttle) |
| `leadsmart_funnel_events` | Append-only: `onboarding_completed`, `first_reply`, `first_ai_usage`, `upgrade_modal_prompt`, `upgrade_checkout_started`, `subscription_active_crm` |
| `leadsmart_try_consume_ai_credit(user_id, monthly_limit)` | RPC: atomic month reset + increment; unlimited when limit ≥ 999999 |

## AI usage limits (`lib/billing/plans.ts`)

`AI_USAGE_MONTHLY_LIMIT`: **free** 8, **starter** 35, **pro/team** unlimited (999999).

- **Effective tier**: active CRM row in `public.subscriptions` → plan slug; otherwise **free**.
- **Mobile AI drafts** (`sms/ai-reply`, `email/ai-reply`): `peekAiUsageAllowed` → run draft → `tryConsumeAiCredit` (fair: no charge on AI failure).
- **Deal assistant** (`POST /api/deal-assistant/analyze`): requires `full_ai`; peek before work, **consume after** successful model calls.

## Upgrade UX

| Mechanism | Role |
|-----------|------|
| `LimitReason` extensions | `ai_usage_limit_reached`, `crm_prediction_locked`, `crm_automation_locked`, `crm_full_ai_locked` |
| `subscriptionRequiredResponse(feature, limitReason)` | HTTP **402** JSON includes `limitReason`, `billingPath` |
| `emitLeadsmartUpgradePrompt(limitReason)` | Client: `window` event → `AgentWorkspaceProviders` opens `EntitlementUpgradeModal` |
| Dashboard layout | Wrapped with `AgentWorkspaceProviders` so the modal is available under `/dashboard/*` |
| `EntitlementUpgradeModal` | CRM reasons link primary CTA to **`/dashboard/billing`** |
| `AutomationProGate` | Soft banner on `/dashboard/automation` when `gates.automation === false` |

### Premium API responses

- **Deal prediction** routes return `limitReason: "crm_prediction_locked"` when the user lacks `prediction`.
- **402** clients (web): parse JSON and call `emitLeadsmartUpgradePrompt(body.limitReason)` when `code === "SUBSCRIPTION_REQUIRED"`.
- **Mobile**: open `billingPageUrl` from `GET /api/billing/subscription` or show in-app WebView to `/dashboard/billing`.

## HTTP APIs

| Route | Description |
|-------|-------------|
| `GET /api/funnel/state` | Onboarding flags, AI usage vs limit, CRM snapshot, `gates.automation` / `gates.prediction` |
| `POST /api/funnel/onboarding-complete` | Body `{ "source"?: string }` — sets `onboarding_completed_at` + event |
| `POST /api/funnel/track` | `{ "event": "upgrade_modal_prompt", "reason"?: string }` — throttled (~18h) via `last_upgrade_prompt_at` |

## Activation events

| Event | When recorded |
|-------|----------------|
| `first_reply` | After successful `POST .../sms/send` or `.../email/send` (mobile), first time only |
| `first_ai_usage` | First successful `tryConsumeAiCredit` for a user (via RPC `first_ai_usage_at`) + `leadsmart_funnel_events` |

Wire **web** outbound replies the same way when you add dashboard send endpoints.

## Analytics (SQL examples)

```sql
-- Onboarding completion count (last 30d)
select count(*) from leadsmart_funnel_events
where event_type = 'onboarding_completed' and created_at > now() - interval '30 days';

-- Activation: first reply after onboarding
select count(*) from leadsmart_funnel_state s
where s.onboarding_completed_at is not null and s.first_reply_at is not null;

-- Upgrade intent → checkout (funnel)
select count(*) filter (where event_type = 'upgrade_checkout_started') as checkouts,
       count(*) filter (where event_type = 'subscription_active_crm') as conversions
from leadsmart_funnel_events
where created_at > now() - interval '30 days';
```

`subscription_active_crm` may repeat on Stripe webhook retries; use `count(distinct (user_id, metadata->>'stripe_subscription_id'))` for stricter conversion.

## Push notifications

- **Hot leads**: existing `dispatchMobileHotLeadPush` via `notifyAgentOfHotLead` (see `docs/MOBILE_PUSH.md`).
- **Reminders**: `dispatchMobileReminderPush` from `GET /api/cron/lead-followups` when `next_contact_at` is due (deduped per lead ~24h).

## Integration checklist

1. Apply funnel migration + RPC.
2. Call `POST /api/funnel/onboarding-complete` from the last step of web/mobile onboarding.
3. On mobile (or web) fetch error **402**, read `limitReason` and open billing or emit upgrade prompt.
4. Optionally call `POST /api/funnel/track` with `upgrade_modal_prompt` when showing a custom upsell (throttled server-side).
