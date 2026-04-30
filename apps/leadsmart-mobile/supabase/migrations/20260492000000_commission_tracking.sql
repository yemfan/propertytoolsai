-- Commission tracking for the agent performance dashboard.
--
-- Two additions:
--   1. Per-transaction commission columns — capture the deal economics
--      at close time so historical GCI + net-commission math doesn't
--      shift when an agent updates their default percentages later.
--   2. Per-agent default prefs — the defaults the agent wants applied
--      when a new transaction is created or closed.
--
-- Design notes:
--   * Amounts are stored alongside percentages. Even though either
--     alone is enough to derive the other from purchase_price, keeping
--     both makes dashboards + CSV exports trivially queryable without
--     N+1 math. Storage cost is negligible.
--   * `agent_net_commission` is what the agent actually takes home
--     after brokerage split + referral fees. This is the "how much did
--     I make" number agents actually care about — the raw GCI number
--     is what their brokerage / IRS sees.
--   * Brokerage split is stored as the AGENT'S share pct (e.g., 70
--     means 70/30 split favoring the agent). That's how agents talk
--     about it ("I'm on a 70/30 at Compass"), not "the brokerage takes
--     30%."
--
-- Recompute trigger:
--   None. The service layer writes these on transaction close +
--   whenever the agent updates commission fields manually. A trigger
--   would fight with manual overrides agents make for unusual deals
--   (referral fees, bonus splits, credit to buyer).

-- ── 1. transactions: per-deal commission columns ──────────────────────

alter table public.transactions
  add column if not exists commission_pct numeric;

alter table public.transactions
  add column if not exists gross_commission numeric;

alter table public.transactions
  add column if not exists brokerage_split_pct numeric;

alter table public.transactions
  add column if not exists referral_fee_pct numeric;

alter table public.transactions
  add column if not exists agent_net_commission numeric;

comment on column public.transactions.commission_pct is
  'Percentage of purchase_price. 2.5 = 2.5%. Typical buyer-rep is 2.5, listing-rep is 3.0 — but always verify the offer of cooperation + RLA.';

comment on column public.transactions.gross_commission is
  'Agent side of the commission before any splits: purchase_price * commission_pct / 100. Stored (not derived) so historical dashboards stay stable if the percentage column is later edited.';

comment on column public.transactions.brokerage_split_pct is
  'Agent share of the split. 70 = 70/30 favoring the agent.';

comment on column public.transactions.referral_fee_pct is
  'Referral fee paid to another agent or referral company. Applied to gross_commission BEFORE brokerage split (standard practice).';

comment on column public.transactions.agent_net_commission is
  'What the agent takes home after referral fee + brokerage split. Computed: gross * (1 - referral/100) * (split/100).';

-- ── 2. agent_commission_prefs ────────────────────────────────────────
-- Per-agent defaults. Dual-type agent_id dispatch so the migration
-- works on both uuid + bigint agents.id installs.

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_commission_prefs (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        default_commission_pct_buyer numeric not null default 2.5,
        default_commission_pct_listing numeric not null default 3.0,
        default_brokerage_split_pct numeric not null default 70.0,
        default_referral_fee_pct numeric not null default 0.0,
        updated_at timestamptz not null default now(),
        constraint agent_commission_prefs_pct_chk
          check (
            default_commission_pct_buyer >= 0 and default_commission_pct_buyer <= 15 and
            default_commission_pct_listing >= 0 and default_commission_pct_listing <= 15 and
            default_brokerage_split_pct >= 0 and default_brokerage_split_pct <= 100 and
            default_referral_fee_pct >= 0 and default_referral_fee_pct <= 100
          )
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.agent_commission_prefs (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        default_commission_pct_buyer numeric not null default 2.5,
        default_commission_pct_listing numeric not null default 3.0,
        default_brokerage_split_pct numeric not null default 70.0,
        default_referral_fee_pct numeric not null default 0.0,
        updated_at timestamptz not null default now(),
        constraint agent_commission_prefs_pct_chk
          check (
            default_commission_pct_buyer >= 0 and default_commission_pct_buyer <= 15 and
            default_commission_pct_listing >= 0 and default_commission_pct_listing <= 15 and
            default_brokerage_split_pct >= 0 and default_brokerage_split_pct <= 100 and
            default_referral_fee_pct >= 0 and default_referral_fee_pct <= 100
          )
      )
    $sql$;
  end if;
end $$;

comment on table public.agent_commission_prefs is
  'Per-agent commission defaults. Applied when a transaction is created/closed without explicit overrides. Can be edited from /dashboard/settings.';
