-- Pre-filter ZIP neighbors to properties that have at least one snapshot with a positive sale price.
-- properties_warehouse has no sold_price column; sale amounts live on property_snapshots_warehouse.

create or replace function public.warehouse_property_ids_in_zip_with_sale_price(
  p_zip text,
  p_exclude_property_id uuid,
  p_max integer default 400
)
returns uuid[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    array_agg(sub.id order by sub.id),
    array[]::uuid[]
  )
  from (
    select distinct p.id
    from public.properties_warehouse p
    inner join public.property_snapshots_warehouse s on s.property_id = p.id
    where p.id <> p_exclude_property_id
      and (
        (p_zip is null and p.zip_code is null)
        or (p_zip is not null and p.zip_code = p_zip)
      )
      and s.estimated_value is not null
      and s.estimated_value > 0
      and (
        lower(trim(coalesce(s.listing_status, ''))) in ('sold', 'closed', 'off_market_sold')
        or nullif(trim(coalesce(s.data ->> 'sale_date', '')), '') is not null
        or nullif(trim(coalesce(s.data ->> 'saleDate', '')), '') is not null
      )
    limit greatest(1, least(coalesce(p_max, 400), 2000))
  ) sub;
$$;

revoke all on function public.warehouse_property_ids_in_zip_with_sale_price(text, uuid, integer) from public;
grant execute on function public.warehouse_property_ids_in_zip_with_sale_price(text, uuid, integer) to authenticated, service_role;
