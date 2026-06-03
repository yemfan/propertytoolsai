-- Week 47: flag vendors as 1099 contractors for year-end tax reporting.
-- The 1099 report (in-app) sums each flagged vendor's PAID bills within a tax
-- year and highlights those at/over the $600 IRS reporting threshold.

alter table vendors
  add column if not exists is_1099 boolean not null default false;
