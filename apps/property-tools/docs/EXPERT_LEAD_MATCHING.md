# Expert CTA & agent matching (AI Property Comparison)

## Flow

1. User clicks **Talk to an Expert** on `/ai-property-comparison` → `expert_cta_clicked` (tracking).
2. Modal collects name, email, phone → `POST /api/leads/expert-capture`.
3. Lead is stored with `source = ai_comparison`, `traffic_source = ai_comparison:expert_cta`, and `capture_context` JSON (subject property, all comparison rows, AI recommendation, match metadata).
4. `lib/matching.ts` ranks agents by `service_areas` + `accepts_new_leads` (see migration `20260328_expert_lead_matching.sql`).
5. Top match becomes `leads.agent_id` (dashboard visibility for that agent). Up to 3 IDs are stored in `capture_context.matched_agent_ids`.
6. Notifications: `AGENT_NOTIFICATION_EMAIL` (global) + email to matched agent’s auth user when available.
7. Tracking: `lead_created`, `agent_matched` (when at least one match).

## Agent configuration

- `agents.service_areas`: text array of lowercase cities and/or 5-digit ZIPs. Empty = still eligible with lower geo score (national/unscoped).
- `agents.accepts_new_leads`: set `false` to exclude from matching.

## Optional SMS

Not wired by default. Extend `expert-capture` to send SMS when Twilio + agent phone are configured.
