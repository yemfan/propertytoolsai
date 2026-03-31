# Voice language (English / Chinese)

## Behavior

1. **First TwiML only** (`buildInboundGatherTwiml`): bilingual greeting (Polly **Joanna** + **Zhiyu**) + **one** preference question (English or Chinese). This is not repeated on later turns (current MVP has a single speech gather).
2. **`processGatheredSpeech`** loads `lead_calls.metadata.voice_session`, runs **`resolveVoiceSessionLanguage`**, stores `voice_session` back, and passes **`outputLanguage`** into **`analyzeVoiceTranscript`** so CRM summary + reasoning match the caller language (when using OpenAI).
3. **`buildClosingTwiml(lang)`** plays **only** `VOICE_CLOSING_SAVED` / `VOICE_CLOSING_SAVED_ZH` with a single voice (Joanna or Zhiyu) — no mixed-language closing.

## Session state (`metadata.voice_session`)

| Field | Meaning |
|--------|---------|
| `language` | `en` \| `zh` \| `null` (null only before first successful lock) |
| `preference_prompt_shown` | `true` after bilingual greeting (set at row creation) |
| `locked_at` | ISO when language was determined |
| `last_detection_method` | `explicit` \| `auto` \| `default_en` \| `unchanged` \| `manual_switch` |

## Detection (`lib/ai-call/voice-language.ts`)

- **Explicit**: keywords (“English”, “中文”, “Chinese”, …).
- **Switch**: phrases like “switch to Chinese”, “用英文” (when already locked).
- **Auto**: CJK ratio + Latin heuristics on the utterance.
- **Default**: if still ambiguous → `en` (`default_en`).
- **Locked + no switch**: `unchanged` (language not re-inferred from mixed content).

Rules: do not re-ask for language in TwiML; do not mix languages after lock (closing + LLM instructions).

## Integration points

| Location | Role |
|----------|------|
| `createLeadCall` | Seeds `metadata.voice_session` |
| `processGatheredSpeech` | Resolves language → `voice_analysis.language`, updates `voice_session` |
| `voice-transcript-analysis.ts` | `buildTranscriptInstructions(outputLanguage)` |
| `app/api/twilio/voice/inbound/route.ts` | `buildClosingTwiml(result.voiceLanguage)` |

## Future (Realtime)

- Pass `VOICE_ASSISTANT_RULES` + locked `language` into the session; use `voiceOpeningLineForFlow` only in that language.
- On switch, update `voice_session` the same way as today (reuse `resolveVoiceSessionLanguage`).
