-- Human-readable SELECT policy name (same rule as entitlement_usage_daily_select_own).

drop policy if exists "entitlement_usage_daily_select_own" on public.entitlement_usage_daily;
drop policy if exists "Users can read own usage" on public.entitlement_usage_daily;

create policy "Users can read own usage"
  on public.entitlement_usage_daily
  for select
  to authenticated
  using (auth.uid() = user_id);
