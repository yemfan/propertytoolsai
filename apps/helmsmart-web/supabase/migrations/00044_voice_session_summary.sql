-- ============================================================
-- Migration 00044: Post-call summary on voice sessions
-- ============================================================
-- The AI receptionist writes a 1–2 sentence recap when a call ends, so the
-- owner can scan the call log without expanding every transcript. Generated
-- after the response (no impact on call latency); null until the call wraps.
-- ============================================================

alter table voice_sessions add column if not exists summary text;
