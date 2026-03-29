create table if not exists affordability_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  input_json jsonb not null,
  result_json jsonb not null,
  max_home_price numeric null,
  target_loan_amount numeric null,
  monthly_budget numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
