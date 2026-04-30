-- Referral program + bonus token wallet.
--
-- Two user-wallets live side-by-side for AI tokens:
--   1. monthly quota on product_entitlements.ai_actions_per_month
--      (resets every calendar month, comes with the plan)
--   2. bonus_tokens on leadsmart_users (perpetual wallet, only
--      refilled by referrals / promos / manual admin grants)
--
-- Consumption rule (see lib/entitlements/accessResult.ts):
--   charge bonus_tokens first; fall back to monthly quota only
--   when bonus is exhausted. This makes referrals feel rewarding
--   (they actually extend the user's runway) rather than silently
--   disappearing into a cap they never reach.
--
-- Referral flow:
--   - Each user has a stable 8-char code (referral_code).
--   - A referral row is created when a new user signs up with
--     ?ref=CODE — status starts 'pending'.
--   - On successful onboarding (complete-profile finalized, or
--     starter plan assigned, whichever comes first) the status
--     flips to 'completed' and both users get +20,000 bonus tokens
--     in a single atomic bump. bonus_granted_at makes the grant
--     idempotent — a retry can't double-pay.

alter table public.leadsmart_users
  add column if not exists referral_code text unique,
  add column if not exists bonus_tokens integer not null default 0;

comment on column public.leadsmart_users.referral_code is
  'Stable 8-char code the user can share. `?ref=CODE` on signup links them as a referrer.';
comment on column public.leadsmart_users.bonus_tokens is
  'Perpetual AI-token wallet. Consumed before the monthly plan quota. Topped up by referrals + promos.';

-- Backfill a code for every existing user who doesn't have one.
-- Uses substr(md5(user_id)) so it's deterministic + collision-free
-- within the existing user set.
update public.leadsmart_users
set referral_code = upper(substr(md5(user_id::text || 'referral-salt-2026'), 1, 8))
where referral_code is null;

create table if not exists public.user_referrals (
  id uuid primary key default gen_random_uuid(),
  -- The user who shared the code
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  -- The user who signed up via it
  referee_user_id uuid not null references auth.users(id) on delete cascade,
  -- 'pending'  = signed up, not yet through onboarding
  -- 'completed' = bonuses granted
  -- 'expired'   = 30+ days stale and referee never completed
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired')),
  -- Non-null only after bonuses actually credited. Idempotent guard.
  bonus_granted_at timestamptz,
  bonus_amount integer not null default 20000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One referral record per referee — a user can only be referred once.
create unique index if not exists idx_user_referrals_referee_unique
  on public.user_referrals (referee_user_id);

create index if not exists idx_user_referrals_referrer
  on public.user_referrals (referrer_user_id);

create index if not exists idx_user_referrals_status
  on public.user_referrals (status, created_at desc);

comment on table public.user_referrals is
  'Referral history: who referred whom, and whether the 20,000-token bonus has been granted.';
