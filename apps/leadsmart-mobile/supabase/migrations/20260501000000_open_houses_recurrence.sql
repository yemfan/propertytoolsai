-- Recurring open houses: a single "recurrence_group_id" stitches
-- together the N rows that were created from one schedule (weekly
-- pattern or multi-date pick). Each occurrence is still its own row
-- with its own slug and its own visitor list — the group_id is
-- purely cosmetic (list grouping) and lets us cancel the series.
--
-- NULL means "one-off" (the existing default).

alter table public.open_houses
  add column if not exists recurrence_group_id uuid;

create index if not exists idx_open_houses_recurrence_group
  on public.open_houses (recurrence_group_id)
  where recurrence_group_id is not null;
