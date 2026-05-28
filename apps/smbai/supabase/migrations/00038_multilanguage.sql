-- ============================================================
-- Migration 00038: Multi-language support
-- ============================================================
-- - clients.preferred_language: remembered per contact so every reply,
--   reminder, and campaign localizes automatically (detected once, reused).
-- - organizations.owner_english_assist: when true the owner also sees English —
--   inbound non-English messages are translated for the inbox, and outbound
--   non-English messages are sent bilingually (their language + English).
-- - messages.translation_en: cached English translation of a non-English
--   inbound message, shown to the owner in the inbox.
-- Idempotent.
-- ============================================================

alter table clients       add column if not exists preferred_language    text;
alter table organizations add column if not exists owner_english_assist  boolean not null default true;
alter table messages      add column if not exists translation_en        text;
