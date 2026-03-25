-- High-intent money-keyword SEO + lead attribution for programmatic pages.

alter table if exists public.seo_pages
  add column if not exists money_keyword text null;

alter table if exists public.seo_pages
  add column if not exists money_keyword_slug text null;

alter table if exists public.seo_expansion_queue
  add column if not exists money_keyword text null;

alter table if exists public.seo_expansion_queue
  add column if not exists money_keyword_slug text null;

comment on column public.seo_pages.money_keyword is
  'Buyer-intent phrase for city_money_keyword template (e.g. luxury homes).';

comment on column public.seo_pages.money_keyword_slug is
  'URL segment before -in-{city} (e.g. good-schools).';

alter table if exists public.leads
  add column if not exists landing_page text null;

alter table if exists public.leads
  add column if not exists seo_slug text null;

comment on column public.leads.landing_page is 'Path when lead submitted (e.g. /homes-under-800k-in-pasadena).';
comment on column public.leads.seo_slug is 'Programmatic SEO slug segment if applicable (same as URL path without leading slash).';
