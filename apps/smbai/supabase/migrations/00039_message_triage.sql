-- ============================================================
-- Migration 00039: Inbound message triage
-- ============================================================
-- AI classifies each inbound message so the owner doesn't triage by hand:
--   intent   = question | booking | billing | complaint | other
--   priority = low | normal | high
-- Used to badge/sort the inbox and auto-create tasks for actionable messages.
-- Idempotent.
-- ============================================================

alter table messages add column if not exists intent   text;
alter table messages add column if not exists priority text;
