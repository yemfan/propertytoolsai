# Hot inbound voice escalation (tasks + agent notify)

## Overview

When speech analysis sets `hot_lead` or `needs_human` on a call, `processGatheredSpeech` runs **`escalateHotInboundVoiceCall`** (`lib/ai-call/hot-call-escalation.ts`). There is no separate `lead_activity_events` table — audit rows are written to **`public.lead_events`** (lead activity timeline).

## Modules

| Module | Responsibility |
|--------|------------------|
| `lib/ai-call/hot-call-task.ts` | `resolveEffectiveAgentId`, `buildVoiceHotFollowUpTaskSpec`, `createVoiceHotFollowUpTask` → `lead_tasks` |
| `lib/ai-call/hot-call-escalation.ts` | Orchestrates task creation, nurture alert, needs-human push, hot-lead notify, and escalation `lead_events` |
| `lib/ai-sms/notifications.ts` | `notifyAgentOfHotLead` — SMS to agent (when enabled) + mobile hot push; may insert `hot_lead_agent_sms_sent` / skip events |
| `lib/mobile/pushNotificationsService.ts` | `dispatchMobileNeedsHumanPush` for `needs_human` |

## Flow (order)

1. **`createVoiceHotFollowUpTask`** — one open `lead_tasks` row per `twilio_call_sid` (deduped via `metadata_json.twilio_call_sid`). Titles/due times are **intent-aware** (e.g. callback within 1 hour for `needs_human`, seller consultation, showing follow-up).
2. **`nurture_alerts`** — type `hot`, deduped 24h per lead+agent (same pattern as SMS high-intent).
3. **`dispatchMobileNeedsHumanPush`** — when `needs_human` and assigned agent exists; then `lead_events` **`voice_hot_escalation_needs_human_push`**.
4. **`notifyAgentOfHotLead`** (`source: "ai_voice"`) — existing hot pipeline: optional SMS (`SMS_HOT_LEAD_AGENT_TEXT`), Expo push, 6h dedupe. May emit `hot_lead_agent_sms_sent`, etc.
5. **`voice_hot_escalation_agent_notify`** — consolidated audit row with `notified`, `channel`, `reason`, `task_created`, `task_id`, `needs_human_push`.

Task creation also emits **`voice_hot_escalation_task_created`** with `task_id`, `due_at`, `priority`, `inferred_intent`.

## Task examples (titles)

Driven by `buildVoiceHotFollowUpTaskSpec` + `needs_human`:

- **Needs human** — “Call back within 1 hour — caller needs an agent”, due ~1h, `urgent`.
- **Appointment** — “Schedule showing / appointment follow-up — voice call”, due ~2h.
- **Buyer** — “Buyer follow-up — listings / tours (voice call)” or financing variant; shorter due when hot.
- **Seller** — “Seller consultation follow-up — voice call”, due ~4h.
- **Default hot** — “Hot lead callback — voice call”, due ~1h.

## Environment

| Variable | Effect |
|----------|--------|
| `SMS_HOT_LEAD_AGENT_TEXT` | Set `false` to skip agent SMS but still allow push (`notifyAgentOfHotLead`) |
| `MOBILE_PUSH_NEEDS_HUMAN` | Disable needs-human Expo push |
| `MOBILE_PUSH_HOT_LEAD` | Disable hot push inside `notifyAgentOfHotLead` |

## Backward compatibility

`handleVoiceHotLeadSideEffects` is an alias of `escalateHotInboundVoiceCall`. `voice-hot-actions.ts` re-exports the task + escalation APIs.
