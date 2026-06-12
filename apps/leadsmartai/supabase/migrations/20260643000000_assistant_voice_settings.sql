-- RealtorBoss — per-assistant call settings + knowledge base.
--
-- Each AI team member that talks on the phone gets its OWN voice
-- identity and knowledge: the Receptionist keeps its existing
-- voice_receptionist_settings table (inbound config is richer:
-- number, greeting, hours), while other assistants — starting with
-- the Sales Assistant's outbound lead calls — store theirs here on
-- their ai_assistants row (build once, configure many).
--
-- Consumers (same PR):
--   • lib/realtorboss/voicePersona.ts   — getAssistantVoiceSettings
--   • lib/voice-agent/context.ts        — loadSalesCallContext overlay
--   • /api/dashboard/realtorboss/assistant-voice — settings UI

alter table public.ai_assistants
  add column if not exists voice_name text,
  add column if not exists voice_knowledge text;

comment on column public.ai_assistants.voice_name is
  'Name this assistant uses on live calls (e.g. "Sophie"). Null = inherit the account voice name.';
comment on column public.ai_assistants.voice_knowledge is
  'This assistant''s own call knowledge base — what it may state as fact on its calls. Null = inherit the Receptionist''s knowledge.';
