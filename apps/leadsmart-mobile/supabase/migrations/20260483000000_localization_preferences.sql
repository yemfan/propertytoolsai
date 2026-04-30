-- Localization preferences — per-lead outbound language, per-user UI + outbound
-- defaults, and the on-demand translation cache backing the inbox toggle.
--
-- Design notes:
--   * All language columns are plain `text`, NOT Postgres enums. Adding a
--     new language should be a one-line addition to `lib/locales/registry.ts`
--     (and its template-seed equivalent), NOT another DDL migration. The
--     app layer validates values through `coerceLocale()` from that
--     registry.
--   * The pre-existing `templates.language` column was typed as an
--     enum-with-CHECK `check (language in ('en', 'zh'))` (see
--     20260479100000_message_templates.sql). We drop that check so it
--     matches the new pattern and future locales need no migration here.
--   * `user_profiles.ui_language` vs `user_profiles.default_outbound_language`
--     are independent. Typical bilingual agent sets both to the same
--     value, but the schema doesn't assume that — it lets agents who
--     operate in English still default their lead outbound to zh, or vice
--     versa, as they grow their book.
--   * `contacts.preferred_language` sits on the unified contacts table
--     (20260480100000_contacts_consolidation_create.sql) and is nullable.
--     Null means "no override — fall through to the agent's default."

-- ── contacts / leads ────────────────────────────────────────────────────
alter table if exists public.contacts
  add column if not exists preferred_language text null;

comment on column public.contacts.preferred_language is
  'BCP-47 base id (e.g. ''zh'', ''en'') the AI should use for outbound messages '
  'to this contact. NULL means "use the agent''s default_outbound_language". '
  'Validated at the app layer against lib/locales/registry.ts; kept as text '
  'so adding a new language does not require a migration.';

create index if not exists idx_contacts_preferred_language
  on public.contacts(preferred_language)
  where preferred_language is not null;

-- ── user_profiles (signed-in agents / users) ───────────────────────────
-- Only `ui_language` lives here. The agent-side default for OUTBOUND
-- language reuses the existing `agent_ai_settings.default_language`
-- column (values 'en' | 'zh' | 'auto') — that's already the field the AI
-- message builders read for language preference, so we avoid a second
-- source of truth. The resolver coerces 'auto' / unknown values back to
-- the registry default.
alter table if exists public.user_profiles
  add column if not exists ui_language text null;

comment on column public.user_profiles.ui_language is
  'BCP-47 base id the dashboard UI renders in for this user. NULL falls '
  'through to ''en''. Gated: only takes effect when lib/locales/registry.ts '
  'has ui.enabled=true for the chosen locale, which currently is only '
  '''en''. Turning on ''zh'' requires 100%% message-catalog coverage.';

-- ── templates.language: relax the enum-style CHECK ─────────────────────
-- Drop the existing CHECK constraint (if it was given the default
-- auto-generated name) so the column becomes open-ended text. App-layer
-- validation via coerceLocale() now owns the acceptable-values set.
do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'templates'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%language%in%(%en%zh%)%';

  if v_constraint_name is not null then
    execute format('alter table public.templates drop constraint %I', v_constraint_name);
  end if;
end $$;

comment on column public.templates.language is
  'BCP-47 base id (e.g. ''en'', ''zh''). Previously CHECK-constrained to '
  '(''en'',''zh''); the constraint was dropped so adding new languages is '
  'a data change in lib/locales/registry.ts, not a DDL migration. App-layer '
  'validation via coerceLocale() owns the acceptable-values set.';

-- ── message_translation_cache ──────────────────────────────────────────
-- Backs the inbox "Translate to English / 翻译为英文" toggle. Content-
-- addressed by sha256(text) so the same sentence sent to N leads only
-- hits the LLM once. Independent of message ids so the cache survives
-- re-fetches and doesn't require FK migration if message tables change.
create table if not exists public.message_translation_cache (
  text_hash text not null,
  source_locale text null,
  target_locale text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  primary key (text_hash, source_locale, target_locale)
);

-- Postgres treats NULL distinctly in primary keys — we want the lookup
-- "hash + NULL source + en target" to match on repeat calls. Add a unique
-- index with NULLS NOT DISTINCT so NULL source_locale collapses into a
-- single cache row instead of accumulating duplicates.
-- (Requires PG 15+. If the target cluster is older, the duplicate-row risk
-- is tiny — re-computes a few extra translations — and the ON CONFLICT
-- in the app-layer insert handles it.)
do $$
begin
  if current_setting('server_version_num')::int >= 150000 then
    execute 'create unique index if not exists '
            'ix_message_translation_cache_nulls_not_distinct '
            'on public.message_translation_cache(text_hash, source_locale, target_locale) '
            'nulls not distinct';
  end if;
end $$;

comment on table public.message_translation_cache is
  'On-demand translation cache backing the inbox translate toggle. Keyed by '
  'sha256(text) so the same message body translated for different leads is '
  'only computed once. Source/target are BCP-47 base ids; source may be NULL '
  'when the caller did not know the source language at write time.';
