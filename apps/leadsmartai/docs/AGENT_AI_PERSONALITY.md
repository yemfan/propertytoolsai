# Agent AI personality (LeadSmart AI)

This document describes how per-agent AI **tone and style** are configured and where they apply. It does **not** change compliance, opt-out handling, escalation rules, or factual constraints — those remain in the base prompts and shared safety layers.

## Data model

- **Table:** `public.agent_ai_settings` (one row per `agents.id`, `ON DELETE CASCADE`).
- **Columns:**
  - `personality`: `friendly` | `professional` | `luxury`
  - `default_language`: `en` | `zh` | `auto` — default when thread language is ambiguous
  - `bilingual_enabled`: when true, instructions allow matching English or Simplified Chinese to the lead (SMS/email)
  - `style_notes`: optional short text (UI/API capped at 500 characters) for vocabulary and phrasing preferences only

**Canonical greeting tone:** When an `agent_ai_settings` row exists, `personality` drives greeting automation tone. If no row exists, `greeting_automation_settings.tone` is used for the user prompt, and the greeting generator system prompt aligns to that same tone via a merged default profile.

## Code layout

| Area | Role |
|------|------|
| `lib/agent-ai/types.ts` | Shared types |
| `lib/agent-ai/profiles.ts` | Reusable prompt layers per personality and channel |
| `lib/agent-ai/promptBuilder.ts` | Composes base prompts + personality + language hints + `style_notes` |
| `lib/agent-ai/settings.ts` | `getAgentAiSettings`, `getAgentAiSettingsWithMeta`, `upsertAgentAiSettings`, `resolveGreetingTone` |

## Integrations

1. **SMS** — `lib/ai-sms/service.ts` loads settings by `lead.assignedAgentId` and passes `buildSmsSystemInstructions(SMS_ASSISTANT_SYSTEM_PROMPT, settings)` to the Responses API `instructions` field.
2. **Email** — `lib/ai-email/service.ts` same pattern with `EMAIL_ASSISTANT_SYSTEM_PROMPT`.
3. **Call transcript analysis** — `lib/ai-call/voice-transcript-analysis.ts` uses `buildVoiceTranscriptAnalysisInstructions`. Classification JSON schema and heuristic fallbacks are unchanged; only summary/reasoning **wording** may reflect personality.
4. **Call assistant (conversational)** — For future OpenAI Realtime / media-stream sessions, use `buildVoiceRealtimeSystemInstructions(VOICE_ASSISTANT_RULES, settings)` from `lib/agent-ai/promptBuilder.ts` when wiring session instructions.
5. **Greeting automation** — `lib/greetings/service.ts` uses `buildGreetingGeneratorSystemInstructions` and `resolveGreetingTone` so AI-generated greetings match the agent’s profile.

## Dashboard API

- `GET /api/dashboard/agent-ai-settings` — current agent’s effective settings (defaults if no row).
- `PATCH /api/dashboard/agent-ai-settings` — partial update; requires authenticated agent context (`getCurrentAgentContext`).

## Migration

Apply `supabase/migrations/20260473100000_agent_ai_settings.sql` (mirrored under `leadsmart-mobile` for shared schema workflows).

## Design rules

- Personality affects **tone, wording, and style** only.
- **Do not** use personality to weaken truthfulness, disclosures, or compliance.
- Base system prompts retain all existing rules; new content is **appended** as additive layers.
