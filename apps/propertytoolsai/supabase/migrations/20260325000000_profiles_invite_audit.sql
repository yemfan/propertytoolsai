-- Who invited internal users (agent / loan_broker / support) and when.
alter table public.profiles
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

alter table public.profiles
  add column if not exists invited_at timestamptz;
