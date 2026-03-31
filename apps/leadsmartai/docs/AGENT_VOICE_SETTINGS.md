# Agent voice settings (LeadSmart AI phone assistant)

Per-agent **preset** voice selection for inbound Twilio calls. Disclosure copy (LeadSmart AI assistant identity) is **not** removed or weakened — only TTS voice and speaking rate vary.

## Data model

- **Table:** `public.agent_voice_settings` (one row per agent, `ON DELETE CASCADE`).
- **Columns:**
  - `provider`: `openai` | `elevenlabs` — selects preset catalog; native OpenAI/ElevenLabs audio is a future integration.
  - `preset_voice_id`: stable id (e.g. `openai_alloy`, `elevenlabs_rachel`).
  - `speaking_style`: `friendly` | `professional` | `luxury` — maps to Twilio `<Say>` `rate` (friendly = default, professional ~95%, luxury ~88%).
  - `default_language`: `en` | `zh` — used when **bilingual** inbound is disabled (single-language TwiML path).
  - `bilingual_enabled`: when `true`, existing bilingual greeting + language-preference flow; when `false`, monolingual path using `default_language`.
- **Future cloning (reserved):** `voice_clone_provider`, `voice_clone_remote_id`, `voice_clone_status` — not used in production playback yet.

## Code layout

| Module | Role |
|--------|------|
| `lib/agent-voice/types.ts` | Types + `TwilioVoicePlayback` |
| `lib/agent-voice/presets.ts` | OpenAI- and ElevenLabs-style presets with Polly mapping + future API ids |
| `lib/agent-voice/resolvePlayback.ts` | `resolveTwilioVoicePlayback(settings)` → Twilio playback |
| `lib/agent-voice/settings.ts` | `getAgentVoiceSettings`, `upsertAgentVoiceSettings` |
| `lib/ai-call/twilio.ts` | TwiML builders accept `TwilioVoicePlayback` |

## Runtime flow

1. Inbound `POST /api/twilio/voice/inbound` resolves the agent from the called number, loads `getAgentVoiceSettings(agentId)`, resolves playback, returns `buildInboundGatherTwiml(url, playback)`.
2. After speech, closing uses the same agent’s settings: `buildClosingTwiml(lang, playback)`.

## Dashboard API

- `GET /api/dashboard/agent-voice-settings` — `{ settings, presets }`
- `PATCH /api/dashboard/agent-voice-settings` — partial update (requires authenticated agent)

## Migration

Apply `supabase/migrations/20260473200000_agent_voice_settings.sql`.

## Future work

- **OpenAI Realtime / TTS:** use `openaiVoiceId` from the selected preset in session config.
- **ElevenLabs:** generate audio URLs or stream; use `elevenLabsVoiceId` from preset.
- **Cloning:** populate `voice_clone_*` and branch playback when `voice_clone_status = 'ready'`.
