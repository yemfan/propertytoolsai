-- Week 35: estimate templates.
-- Reusable line-item sets so common jobs can be quoted in seconds.

create table if not exists estimate_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  tax_rate        numeric(5,4) not null default 0,   -- fraction, e.g. 0.0875
  notes           text,
  lines           jsonb not null default '[]'::jsonb, -- [{description, quantity, unit_price, amount}]
  created_at      timestamptz not null default now()
);

create index if not exists idx_estimate_templates_org
  on estimate_templates (organization_id, created_at desc);

alter table estimate_templates enable row level security;

-- Members of the org can manage its templates. Uses the SECURITY DEFINER
-- helper (no recursion) consistent with the rest of the schema.
create policy "members manage estimate_templates"
  on estimate_templates
  for all
  using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
