-- Optional subscription window on product_entitlements + convenience view for “currently valid” rows.

alter table public.product_entitlements
  add column if not exists starts_at timestamptz;

alter table public.product_entitlements
  add column if not exists ends_at timestamptz;

comment on column public.product_entitlements.starts_at is
  'Inclusive start of entitlement window; NULL = no lower bound.';
comment on column public.product_entitlements.ends_at is
  'Inclusive end of entitlement window; NULL = no upper bound.';

create index if not exists idx_product_entitlements_starts_at
  on public.product_entitlements (starts_at)
  where starts_at is not null;

create index if not exists idx_product_entitlements_ends_at
  on public.product_entitlements (ends_at)
  where ends_at is not null;

drop view if exists public.active_product_entitlements;

create or replace view public.active_product_entitlements as
select
  id,
  user_id,
  product,
  plan,
  is_active,
  cma_reports_per_day,
  max_leads,
  max_contacts,
  alerts_level,
  reports_download_level,
  team_access,
  starts_at,
  ends_at,
  created_at,
  updated_at
from public.product_entitlements
where is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now());

comment on view public.active_product_entitlements is
  'Rows in product_entitlements that are active and within starts_at/ends_at (if set).';

grant select on public.active_product_entitlements to authenticated;
grant select on public.active_product_entitlements to service_role;
