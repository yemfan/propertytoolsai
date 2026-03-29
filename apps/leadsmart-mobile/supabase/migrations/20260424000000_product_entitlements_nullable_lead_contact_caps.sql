-- Elite / unlimited: NULL on max_leads / max_contacts means no cap (same intent as legacy -1 in app).

alter table public.product_entitlements
  alter column max_leads drop not null,
  alter column max_contacts drop not null;

comment on column public.product_entitlements.max_leads is
  'Max leads for the plan; NULL = unlimited.';
comment on column public.product_entitlements.max_contacts is
  'Max CRM contacts for the plan; NULL = unlimited.';
