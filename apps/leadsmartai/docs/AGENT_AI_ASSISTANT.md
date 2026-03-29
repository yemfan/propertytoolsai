# Agent-Side AI Assistant (LeadSmart AI)

## Overview

- **Auto reply**: `lib/autoReply.ts` — `generateInitialReply(lead)` from location, price range, behavior.
- **AI replies**: `lib/aiReplyGenerator.ts` — `generateReply(context)` via OpenAI (fallback if no key).
- **Follow-ups**: `lib/followUp.ts` — schedules **1h / 24h / 3d** jobs; cron sends SMS if **no inbound reply** after the job was created.
- **Conversation memory**: table `lead_conversations` (`lead_id`, `messages` jsonb, `preferences` jsonb).
- **SMS**: Twilio when `TWILIO_*` env vars are set.
- **Controls**: `agents.ai_assistant_enabled`, `agents.ai_assistant_mode` (`auto` | `manual`).

## Env

- `OPENAI_API_KEY` — AI suggestions.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — outbound SMS.
- `CRON_SECRET` — optional; `GET /api/cron/ai-followups` with `?token=` or `Authorization: Bearer`.

## Migration

Run `supabase/migrations/20260329_agent_ai_assistant.sql` (adds columns + `lead_conversations` + `ai_followup_jobs`).

`lead_conversations.agent_id` and `ai_followup_jobs.agent_id` are created as **`uuid` or `bigint`** to match `public.agents.id` (same pattern as `20260319_tasks_schema_compat.sql`). If a previous attempt left tables with the wrong `agent_id` type, the migration drops and recreates those two tables.

## Cron

Schedule `GET /api/cron/ai-followups` every 5–15 minutes (e.g. Vercel Cron).

## Response / conversion metrics

- `events` rows with `event_type: outreach_sent` and metadata `{ channel, lead_id }` support funnel reporting.
- Extend with dedicated `response_rate` / `conversion_rate` aggregates in analytics as needed.
