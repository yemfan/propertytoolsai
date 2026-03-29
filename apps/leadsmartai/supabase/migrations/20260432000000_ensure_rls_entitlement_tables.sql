-- Idempotent: ensure RLS is enabled (safe if already on from 20260421000000_product_entitlements.sql).

alter table if exists public.product_entitlements enable row level security;
alter table if exists public.entitlement_usage_daily enable row level security;
