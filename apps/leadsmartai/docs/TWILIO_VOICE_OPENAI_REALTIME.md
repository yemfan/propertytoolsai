# Twilio Voice + OpenAI Realtime (integration notes)

## Current (MVP)

- `POST /api/twilio/voice/inbound` — TwiML + `<Gather speech>`; `lib/ai-call/service.ts` handles CRM + `lead_events` + optional `lead_conversations` note.
- `POST /api/twilio/voice/status` — duration, recording URL, status → `lead_calls` + `lead_call_events`.
- `POST /api/twilio/voice/media-stream` — TwiML `<Connect><Stream>` when `TWILIO_MEDIA_STREAM_WSS_URL` is set.
- DB: apply `20260472000000_lead_calls_voice.sql` then `20260472100000_lead_calls_crm_v2.sql` (renames `from_phone`/`to_phone`, `status`, `inferred_intent`, `needs_human`, `lead_call_events.lead_call_id`).

## Activity timeline

- `public.lead_events` (not a separate `lead_activity_events` table) — one row per inbound/speech milestone.
- `lead_conversations.messages[]` gets a short assistant note after speech.

## Future: Media Streams + OpenAI Realtime

- Run a **WebSocket bridge** (Node/Fly/ECS); Next.js does not host the Twilio media WebSocket.
- Point `TWILIO_MEDIA_STREAM_WSS_URL` at that bridge; see [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams).

## Environment

`apps/leadsmartai/.env.example` — `APP_BASE_URL`, `TWILIO_*`, `LEADSMART_VOICE_DEFAULT_AGENT_ID`, `VOICE_INBOUND_AGENT_MAP`, `TWILIO_MEDIA_STREAM_WSS_URL`.

## Hooks

- `lib/ai-call/hooks.ts` — `voiceHooks.onCallProcessed` after speech classification.
