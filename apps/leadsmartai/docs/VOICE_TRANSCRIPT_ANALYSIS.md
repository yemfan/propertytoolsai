# Voice transcript analysis (OpenAI Responses API)

## Overview

After Twilio captures caller speech, `processGatheredSpeech` in `lib/ai-call/service.ts` runs **transcript summarization + intent classification** using the **OpenAI Responses API** (`client.responses.create`) with **structured JSON** (`text.format.type: json_schema`, `strict: true`).

If `OPENAI_API_KEY` is missing or the API fails, the same pipeline falls back to **heuristics** (`lib/ai-call/heuristics.ts` + `summary.ts`).

## Environment

| Variable            | Purpose                                      |
|---------------------|----------------------------------------------|
| `OPENAI_API_KEY`    | Required for LLM path (see `lib/ai/openaiClient.ts`) |
| `OPENAI_MODEL`      | Optional; defaults to `gpt-4o-mini`          |

## Data written

### `lead_calls`

| Column           | Content |
|------------------|---------|
| `transcript`     | Raw captured speech |
| `summary`        | 2–4 sentence summary |
| `inferred_intent`| One of `buyer_listing_inquiry`, `buyer_financing`, `seller_home_value`, `seller_list_home`, `appointment`, `support`, `unknown` |
| `hot_lead`       | Boolean |
| `needs_human`    | Boolean |
| `metadata.voice_analysis` | `inferred_intent`, `intent_role`, `reasoning` (LLM clauses), `source`, `model`, `analyzed_at` |

### `lead_call_events`

Event `speech_analyzed` includes `inferred_intent`, `intent_role`, `reasoning` `{ intent, hot_lead, needs_human }`, `source`, `model`.

### Lead activity timeline

**Table:** `public.lead_events` (there is no separate `lead_activity_events` table).

Event `voice_call_speech` includes the same reasoning payload plus `transcript_preview`, `summary`, etc.

## Module map

| File | Role |
|------|------|
| `lib/ai-call/prompts.ts` | `VOICE_TRANSCRIPT_RESPONSES_INSTRUCTIONS` (concise RE-specific instructions) |
| `lib/ai-call/voice-transcript-schema.ts` | JSON Schema for structured outputs |
| `lib/ai-call/voice-transcript-analysis.ts` | `analyzeVoiceTranscript()` — Responses API + Zod + fallback |
| `lib/ai-call/service.ts` | `processGatheredSpeech` persistence + hooks + hot-lead side effects |
| `lib/ai-call/heuristics.ts` | Keyword intent + `voiceIntentCategory()` + hot detection |

## Flow (after transcript capture)

1. Resolve `lead_calls` row by `twilio_call_sid`.
2. `analyzeVoiceTranscript(transcript)`.
3. Update `lead_calls` columns + merge `metadata.voice_analysis`.
4. Insert `lead_call_events` (`speech_analyzed`).
5. Insert `lead_events` (`voice_call_speech`) when `lead_id` present.
6. Optional hot-path: `escalateHotInboundVoiceCall` (`lib/ai-call/hot-call-escalation.ts`) when `hot_lead` or `needs_human` — see [HOT_VOICE_ESCALATION.md](./HOT_VOICE_ESCALATION.md).

## API notes

- Uses `store: false` on Responses to avoid retaining payloads on OpenAI’s side where supported.
- Transcript is truncated to **8000** characters before the model call.
