-- One funnel row per client session (enables upsert from /api/home-value-estimate).
create unique index if not exists uq_home_value_sessions_session_id
  on public.home_value_sessions (session_id);
