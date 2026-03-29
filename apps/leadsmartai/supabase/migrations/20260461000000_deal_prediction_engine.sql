-- Deal prediction: 3–6 month buy/sell likelihood (rules-based, explainable factors in JSON).
-- Distinct from `lead_scores` (AI intent/timeline) and `leads.score` (marketplace rules).

alter table if exists public.leads
  add column if not exists prediction_score smallint,
  add column if not exists prediction_label text,
  add column if not exists prediction_factors jsonb not null default '[]'::jsonb,
  add column if not exists prediction_computed_at timestamptz;

comment on column public.leads.prediction_score is '0–100 deal likelihood in next ~3–6 months (rules engine; see prediction_factors).';
comment on column public.leads.prediction_label is 'low | medium | high — derived from prediction_score thresholds.';
comment on column public.leads.prediction_factors is 'Explainable breakdown: array of { id, label, pointsEarned, pointsMax, detail }.';
comment on column public.leads.prediction_computed_at is 'When prediction_score was last computed.';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'leads' and c.conname = 'leads_prediction_score_range'
  ) then
    alter table public.leads
      add constraint leads_prediction_score_range
      check (prediction_score is null or (prediction_score >= 0 and prediction_score <= 100));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'leads' and c.conname = 'leads_prediction_label_enum'
  ) then
    alter table public.leads
      add constraint leads_prediction_label_enum
      check (
        prediction_label is null
        or prediction_label in ('low', 'medium', 'high')
      );
  end if;
end $$;

create index if not exists idx_leads_agent_prediction_score
  on public.leads(agent_id, prediction_score desc nulls last)
  where merged_into_lead_id is null;

create index if not exists idx_leads_prediction_computed_at
  on public.leads(prediction_computed_at desc nulls last)
  where merged_into_lead_id is null;
