-- Human-readable SELECT policy name (same rule as product_entitlements_select_own).

drop policy if exists "product_entitlements_select_own" on public.product_entitlements;
drop policy if exists "Users can read own entitlements" on public.product_entitlements;

create policy "Users can read own entitlements"
  on public.product_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);
