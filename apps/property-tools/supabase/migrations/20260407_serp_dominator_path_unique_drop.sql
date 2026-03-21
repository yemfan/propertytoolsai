-- If 20260406 was applied with UNIQUE(path), drop it so campaigns can re-run the same URLs per keyword_slug.
alter table public.serp_dominator_pages drop constraint if exists serp_dominator_pages_path_key;

create index if not exists idx_serp_dominator_pages_path on public.serp_dominator_pages (path);
