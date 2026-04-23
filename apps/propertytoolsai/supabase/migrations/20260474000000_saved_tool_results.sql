-- Saved calculator results. Per-user; each row is a snapshot of the
-- inputs + computed output from one of the ~14 calculator tools. A
-- "Save Results" button on every calculator requires login → writes
-- here → the visitor can open /account/saved-results later to review
-- or share.
--
-- `inputs` and `results` are intentionally flexible jsonb: each tool
-- has its own shape (mortgage payment, cap rate, ARM schedule, CMA
-- comps, etc.). We don't normalize them — if the tool's schema
-- changes later, old rows are still a faithful snapshot of what the
-- user saw that day.
create table if not exists public.saved_tool_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Tool identifier matches the `tool` prop we pass into
  -- <ToolLeadGate> (e.g. "mortgage_calculator", "ai_cma_analyzer").
  tool text not null,

  -- Optional label the user types in when saving ("Main St offer v2").
  label text,

  -- Optional — convenience for display + for reopening in the tool.
  property_address text,

  -- Input form state at save time. One tool per row.
  inputs jsonb not null default '{}'::jsonb,

  -- Computed metrics at save time (cap rate, payment, etc.).
  results jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hot path: a user opening /account/saved-results sees their own
-- rows, newest first.
create index if not exists idx_saved_tool_results_user_created
  on public.saved_tool_results (user_id, created_at desc);

-- Admin analytics: "how many mortgage saves this week" type queries.
create index if not exists idx_saved_tool_results_tool_created
  on public.saved_tool_results (tool, created_at desc);

alter table public.saved_tool_results enable row level security;

-- Users read + manage their own saves. Service-role writes from the
-- API route can bypass RLS (service_role key already does).
create policy saved_tool_results_select_own
  on public.saved_tool_results
  for select
  to authenticated
  using (user_id = auth.uid());

create policy saved_tool_results_insert_own
  on public.saved_tool_results
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy saved_tool_results_update_own
  on public.saved_tool_results
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy saved_tool_results_delete_own
  on public.saved_tool_results
  for delete
  to authenticated
  using (user_id = auth.uid());
