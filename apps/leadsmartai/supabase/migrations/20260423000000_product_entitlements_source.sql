-- Track how an entitlement row was created (manual insert, free start, Stripe, admin, etc.)

alter table public.product_entitlements
  add column if not exists source text;

comment on column public.product_entitlements.source is
  'Origin of the entitlement (e.g. free_start, stripe, admin_grant, migration).';

create index if not exists idx_product_entitlements_source
  on public.product_entitlements (source)
  where source is not null;
