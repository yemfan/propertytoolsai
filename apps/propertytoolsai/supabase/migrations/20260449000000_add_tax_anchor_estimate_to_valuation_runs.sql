-- Adds a dedicated tax anchor value for ML features.
-- For now it is nullable until we define the real tax anchor formula.

alter table if exists public.valuation_runs
add column if not exists tax_anchor_estimate numeric null;

