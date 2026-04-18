-- Contacts consolidation — Part 1 of 3: drop legacy tables.
--
-- Pre-release nuclear rebuild: collapse `leads` (bigint) and `sphere_contacts`
-- (uuid) into a single `contacts` (uuid) table. Audit showed 19 of the 23
-- child tables of `leads` are DEAD or HALF-BUILT. Drop them all; rebuild the
-- 4 USED ones against the new uuid contacts.id in part 2.
--
-- CASCADE is intentional — we want FK dependents to go too. `basically nothing`
-- real data per product owner.

-- Sphere family (uuid FKs)
drop table if exists public.trigger_firings cascade;
drop table if exists public.message_drafts cascade;
drop table if exists public.sphere_contact_triggers cascade;
drop table if exists public.sphere_signals cascade;
drop table if exists public.sphere_contacts cascade;

-- Leads child tables — USED (rebuild in part 2)
drop table if exists public.crm_tasks cascade;
drop table if exists public.automation_logs cascade;
drop table if exists public.lead_events cascade;
drop table if exists public.lead_scores cascade;

-- Leads child tables — HALF-BUILT (defer rebuild until features ship)
drop table if exists public.sms_conversations cascade;
drop table if exists public.sms_messages cascade;
drop table if exists public.communications cascade;
drop table if exists public.email_messages cascade;
drop table if exists public.lead_calendar_events cascade;
drop table if exists public.greeting_message_history cascade;

-- Leads child tables — DEAD (drop permanently)
drop table if exists public.lead_conversations cascade;
drop table if exists public.ai_followup_jobs cascade;
drop table if exists public.client_portal_documents cascade;
drop table if exists public.client_portal_messages cascade;
drop table if exists public.client_saved_homes cascade;
drop table if exists public.lead_booking_links cascade;
drop table if exists public.lead_duplicate_candidates cascade;
drop table if exists public.lead_enrichment_runs cascade;
drop table if exists public.lead_pricing_predictions cascade;
drop table if exists public.leadsmart_runs cascade;
drop table if exists public.reengagement_logs cascade;

-- Keep automation_rules (parent of automation_logs) — no FK to leads, just referenced by.

-- The leads table itself
drop table if exists public.leads cascade;

-- Legacy helper functions that referenced leads(id) by bigint
drop function if exists public.log_lead_event(bigint, text, jsonb, text);
drop function if exists public.log_lead_event(uuid, text, jsonb, text);
drop function if exists public.bump_lead_engagement(bigint, integer);
drop function if exists public.bump_lead_engagement(uuid, integer);
