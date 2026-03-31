# Voice scripts & future Realtime handling

## Files

| File | Purpose |
|------|---------|
| `lib/ai-call/voice-scripts.ts` | Spoken copy: greeting, seller/buyer/financing/appointment lines, urgency, escalation, closings, voicemail, `VOICE_SCRIPTS` bundle, helpers |
| `lib/ai-call/prompts.ts` | `VOICE_ASSISTANT_RULES` (includes `voiceScriptsPromptBlock()` output), `VOICE_REALTIME_FLOW_SUMMARY`, transcript classification instructions, re-exports scripts |
| `lib/ai-call/twilio.ts` | TwiML builders: `buildInboundGatherTwiml`, `buildClosingTwiml`, `buildSafeFallbackTwiml`, `buildVoicemailFallbackTwiml` |

## Current production path (TwiML MVP)

- **Single gather** after bilingual greeting (`buildInboundGatherTwiml`) → speech posted to `POST /api/twilio/voice/inbound` → `processGatheredSpeech` (language resolution + transcript analysis). See [VOICE_LANGUAGE.md](./VOICE_LANGUAGE.md).
- Flow-specific lines in `voice-scripts.ts` are **not** played turn-by-turn yet; they are for **Realtime** and for **prompt injection** (`VOICE_ASSISTANT_RULES`).

## CRM integration

After transcript analysis, `lead_calls.metadata.voice_analysis` includes **`qualification_flow`**: `seller` | `buyer` | `financing` | `appointment` | `general` (from `voiceFlowKeyFromIntent`).

## Future: OpenAI Realtime (or multi-turn Twilio)

1. **Session instructions**: set system prompt to `VOICE_ASSISTANT_RULES` (full) or `VOICE_ASSISTANT_RULES` + trim with `VOICE_REALTIME_FLOW_SUMMARY` if token-limited.
2. **Turn tool / state machine**: map STT intent to `voiceOpeningLineForFlow()` for the first follow-up after greeting; advance through `VOICE_FLOW_*` objects one question at a time.
3. **Urgency**: when model detects urgency, prefer `VOICE_URGENCY_ACK` + `VOICE_URGENCY_QUESTION` before closing.
4. **Escalation**: on risk flags, use `VOICE_ESCALATION_*` strings; set `needs_human` in CRM via existing pipeline.
5. **Closing**: `voiceClosingLine(kind)` — e.g. `priority` after urgency, `escalation` after handoff, `saved` default.
6. **Voicemail**: use `buildVoicemailFallbackTwiml()` from a dial status / IVR branch; configure `recordingStatusCallback` when you persist recordings.

## Exports

Import from `@/lib/ai-call` or `@/lib/ai-call/voice-scripts` — `voiceScriptsPromptBlock`, `voiceFlowKeyFromIntent`, `voiceOpeningLineForFlow`, `voiceClosingLine`, `VOICE_SCRIPTS`.
