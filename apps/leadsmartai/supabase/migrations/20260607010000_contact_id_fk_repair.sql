-- Contact-id FK repair after the leads→contacts rename.
--
-- 26 tables had `lead_id bigint → leads(id)` FKs that were dropped
-- when the column was renamed to `contact_id uuid` (commit 3ded327f).
-- New FKs to `contacts(id)` were never re-added, so PostgREST joins
-- like `contacts!inner(...)` fail with "Could not find a relationship
-- between '<table>' and 'contacts' in the schema cache".
--
-- The /dashboard/offers crash ("Dashboard couldn't load") was the
-- most visible symptom — listOffersForAgent() does
-- `from("offers").select("*, contacts!inner(...)")` and that resolves
-- via the FK.
--
-- Orphan audit (2026-05-02):
--   - 24 tables: 0 orphan rows → safe to add FK with full validation.
--   - postcard_sends: 2/2 rows orphan → add NOT VALID, clean later.
--   - showings: 1/1 row orphan → add NOT VALID, clean later.
--
-- All ADD CONSTRAINT statements use IF NOT EXISTS via DO blocks since
-- pg < 18 doesn't support `ADD CONSTRAINT IF NOT EXISTS`. Idempotent.

-- Two of the original 26 names are VIEWs (lead_events, lead_scores)
-- aliasing the canonical contacts-pivot tables. Views can't take an
-- ALTER TABLE ADD CONSTRAINT, and the underlying tables already have
-- the FK or are out of scope for this rename — exclude them here.
DO $$
DECLARE
  clean_tables text[] := ARRAY[
    'agent_property_recommendations','buyer_broker_agreements','call_logs','cma_reports',
    'contact_property_favorites','contact_saved_searches','email_events','inbound_contact_requests',
    'lead_calls','listing_presentations','marketing_plans',
    'nurture_alerts','offers','open_house_visitors','review_requests',
    'signature_envelopes','sphere_drip_enrollments','testimonials','transactions',
    'video_messages','wechat_messages','wechat_user_links'
  ];
  dirty_tables text[] := ARRAY['postcard_sends','showings'];
  t text;
  fk_name text;
  rel_kind char;
BEGIN
  -- Clean tables: full FK with validation. Skip silently if the
  -- relation is a view (defensive — current set is BASE TABLE only).
  FOREACH t IN ARRAY clean_tables LOOP
    SELECT relkind INTO rel_kind FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = t;
    IF rel_kind <> 'r' THEN CONTINUE; END IF;

    fk_name := t || '_contact_id_fkey';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk_name) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE',
        t, fk_name
      );
    END IF;
  END LOOP;

  -- Dirty tables: NOT VALID. Skips the existing-row check; future
  -- writes are still enforced and PostgREST sees the relationship.
  FOREACH t IN ARRAY dirty_tables LOOP
    SELECT relkind INTO rel_kind FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = t;
    IF rel_kind <> 'r' THEN CONTINUE; END IF;

    fk_name := t || '_contact_id_fkey';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk_name) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE NOT VALID',
        t, fk_name
      );
    END IF;
  END LOOP;
END $$;

-- Refresh PostgREST schema cache so the new FKs are visible to API
-- joins immediately. Without this, the join syntax keeps failing
-- until the next deploy or background refresh.
NOTIFY pgrst, 'reload schema';
