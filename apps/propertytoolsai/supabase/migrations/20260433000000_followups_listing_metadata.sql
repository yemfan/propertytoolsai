-- Listing follow-ups + conversation threads carry provider-specific metadata.

alter table if exists public.lead_followups
  add column if not exists variant_key text null;

alter table if exists public.lead_followups
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.lead_conversations
  add column if not exists metadata jsonb not null default '{}'::jsonb;
