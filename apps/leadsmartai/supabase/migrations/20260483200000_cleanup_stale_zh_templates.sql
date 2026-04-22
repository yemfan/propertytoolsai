-- Cleanup: remove the 15 rows seeded by the stale
-- 20260483100000_seed_zh_templates.sql migration.
--
-- Context: two migrations with the same 20260483100000 prefix landed on
-- main simultaneously —
--   * _seed_zh_templates.sql  (stale — non-canonical placeholders like
--                              {{lead_name}}, {{property_address}};
--                              standalone rows with variant_of = NULL;
--                              transaction milestones mis-categorized as
--                              `lifecycle` instead of `lead_response`)
--   * _seed_zh_variants.sql   (correct — canonical placeholders like
--                              {{first_name}}, {{street_name}}; variants
--                              keyed to English parents; proper category)
--
-- Alphabetical order runs _templates first, so the stale rows land first.
-- The correct _variants migration then inserts 22 non-colliding rows
-- successfully, but the one overlapping ID (`zh_sphere_chinese_new_year_sms`)
-- hits ON CONFLICT DO NOTHING — the stale version wins the race and the
-- canonical version is silently dropped.
--
-- This migration:
--   (1) deletes all 15 stale rows by id (idempotent — if a row is already
--       absent because the stale migration never ran, DELETE is a no-op);
--   (2) re-inserts the canonical `zh_sphere_chinese_new_year_sms` that
--       would otherwise be lost to the conflict above.
--
-- Why not just delete the stale migration file from main:
--   Supabase tracks applied migrations by filename in
--   `supabase_migrations.schema_migrations`. Removing a migration that
--   has been applied causes a "missing" complaint on the next `db push`.
--   Leaving the file + cleaning up via a later migration is the safer
--   operational shape — works whether the stale file already ran or not.

-- ── (1) delete stale rows ─────────────────────────────────────────────
delete from public.templates
where id in (
  'zh_lead_first_response_sms',
  'zh_lead_first_response_email',
  'zh_lead_followup_24h_sms',
  'zh_lead_followup_48h_email',
  'zh_lead_tour_interest_qualifier_sms',
  'zh_lifecycle_tour_confirmation_sms',
  'zh_lifecycle_tour_recap_email',
  'zh_lifecycle_offer_submitted_sms',
  'zh_lifecycle_offer_accepted_sms',
  'zh_lifecycle_closing_confirmed_email',
  'zh_sphere_birthday_sms',
  'zh_sphere_chinese_new_year_sms',
  'zh_sphere_quarterly_market_checkin_email',
  'zh_sphere_annual_home_value_update_email',
  'zh_sphere_referral_ask_email'
);

-- ── (2) re-insert the canonical CNY ───────────────────────────────────
-- Identical row to the INSERT in 20260483100000_seed_zh_variants.sql —
-- needed because the DELETE above (or the earlier ON CONFLICT race) wipes
-- it out. ON CONFLICT DO NOTHING guards against the unlikely case where
-- the row already exists with the canonical content.
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_sphere_chinese_new_year_sms', 'sphere', '新春祝福 · 简体中文', 'sms',
  null,
  $body${{first_name}}，新春快乐！祝您和家人在新的一年身体健康，万事如意。—{{agent_first_name}}$body$,
  'zh', null,
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_fixed", "lunar_calendar": "cny_day_1", "time_local": "09:00", "frequency": "yearly"}'::jsonb,
  $note$Culturally specific — no English parent by design. Generic zodiac-agnostic wording so it does not need annual rewrites. Only send to contacts with preferred_language='zh'.$note$,
  'review', 'invented'
) on conflict (id) do nothing;
