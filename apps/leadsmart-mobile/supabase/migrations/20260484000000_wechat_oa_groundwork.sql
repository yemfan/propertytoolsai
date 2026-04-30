-- WeChat Official Account (OA) integration — groundwork schema.
--
-- Three tables, all dormant until the JV-owned Service Account is
-- registered with Tencent and credentials land in env / the
-- `wechat_oa_accounts` row. The webhook route at
-- `app/api/wechat/callback/route.ts` reads from these tables and
-- refuses traffic unless a row exists + WECHAT_ENABLED=1.
--
-- Architectural notes:
--
-- * Single JV-owned OA is the realistic shape — Tencent Service Account
--   registration requires a Chinese business entity (营业执照), and
--   asking each US-based agent to register their own is impractical.
--   One `wechat_oa_accounts` row covers the whole fleet; agents appear
--   as senders inside the JV's OA via message-level branding (avatar,
--   name prefix).
--
-- * `wechat_user_links` maps a WeChat subscriber (openid) to the agent
--   whose QR they scanned (agent_id) and, when identifiable, to the
--   existing CRM contact record (contact_id). The QR code's `scene`
--   parameter carries the agent_id so we can route new subscribers
--   into the right agent's book.
--
-- * `wechat_messages` is the per-OA analogue of `sms_messages` and
--   `email_messages`. Keeping it separate (rather than overloading
--   the SMS table with a channel column) avoids forcing WeChat-specific
--   columns (msg_type, event_type, template_id, openid) onto the
--   existing SMS/email flows. A `channel` view can unify the three
--   later for the inbox without schema surgery.
--
-- * Signatures + secrets (WECHAT_APP_SECRET, WECHAT_ENCODING_AES_KEY)
--   do NOT live in this table — they come from env. Storing them in
--   the DB would expand the "if our DB leaks, the attacker can post
--   outbound WeChat messages as us" blast radius unnecessarily. The
--   public app_id + verification_token (which are webhook-path
--   knowledge anyway) are stored here for reference.

-- ── wechat_oa_accounts ──────────────────────────────────────────────
create table if not exists public.wechat_oa_accounts (
  id uuid primary key default gen_random_uuid(),
  /** Tencent-issued OA identifier, format "wxXXXXXXXXXXXXXXXX". */
  app_id text not null unique,
  /** Human-readable JV OA name for admin surfaces. */
  display_name text not null,
  /** Token the webhook shares with Tencent for signature verification.
      See /api/wechat/callback signature check. Stored here because it's
      not a secret per se — it travels with every webhook request and
      pairing the hash check against DB-side value supports rotation. */
  verification_token text not null,
  /** True once Tencent has approved the OA's webhook + primary capabilities. */
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wechat_oa_accounts is
  'Registered WeChat Official Accounts. Single JV-owned row is the '
  'typical shape; multi-row support lets a future tier sell dedicated '
  'OA hosting to brokerage customers without a second migration.';

-- ── wechat_user_links ───────────────────────────────────────────────
create table if not exists public.wechat_user_links (
  id uuid primary key default gen_random_uuid(),
  oa_account_id uuid not null references public.wechat_oa_accounts(id) on delete cascade,
  /** Tencent-issued opaque subscriber id, unique per (OA, user) pair. */
  openid text not null,
  /** When identified, the CRM contact this subscriber is. Kept nullable
      because first interaction may not yet include contact info. Use
      phone / email enrichment to backfill post-hoc. */
  contact_id uuid references public.contacts(id) on delete set null,
  /** Agent whose QR the subscriber scanned. Derived from the QR's
      `scene` parameter at subscribe time. Nullable for subscribers
      whose entry point we didn't capture (rare). */
  agent_id bigint references public.agents(id) on delete set null,
  /** First subscribe event. */
  subscribed_at timestamptz not null default now(),
  /** Null until they unsubscribe. Cleared if they re-subscribe. */
  unsubscribed_at timestamptz,
  /** Last inbound event, used for the 48-hour customer-service window. */
  last_interaction_at timestamptz,
  /** Raw `EventKey` / `Scene` from the QR scan (e.g. "agent_123"). */
  scene_qr_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (oa_account_id, openid)
);

create index if not exists idx_wechat_user_links_contact
  on public.wechat_user_links(contact_id)
  where contact_id is not null;
create index if not exists idx_wechat_user_links_agent
  on public.wechat_user_links(agent_id)
  where agent_id is not null;

comment on table public.wechat_user_links is
  'OA subscriber roster. One row per (OA, openid) pair. Populated on '
  'subscribe events from the Tencent webhook. Agents "own" subscribers '
  'whose scene QR routed to them at subscribe time.';
comment on column public.wechat_user_links.last_interaction_at is
  'Updated on every inbound message or event. The 48-hour customer-'
  'service-message window (Tencent rule) is measured from this value; '
  'after 48h of silence, we can only send pre-approved template '
  'messages to this subscriber.';

-- ── wechat_messages ─────────────────────────────────────────────────
create table if not exists public.wechat_messages (
  id uuid primary key default gen_random_uuid(),
  oa_account_id uuid not null references public.wechat_oa_accounts(id) on delete cascade,
  openid text not null,
  /** Denormalized from wechat_user_links at insert time so historical
      messages stay attributed even if the link row is later reassigned. */
  contact_id uuid references public.contacts(id) on delete set null,
  agent_id bigint references public.agents(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  /** Tencent message type: 'text', 'event', 'image', 'voice', 'video',
      'shortvideo', 'location', 'link'. For outbound: also 'template'
      (pre-approved template messages) and 'customer_service' (free-form
      replies within the 48h window). */
  msg_type text not null,
  /** When msg_type='event': Tencent event name, e.g. 'subscribe',
      'unsubscribe', 'SCAN', 'CLICK', 'VIEW'. */
  event_type text,
  /** Text body (for text messages) or caption (for media). */
  content text,
  /** Pre-approved template id (outbound template messages only). */
  template_id text,
  /** Tencent's MsgId for inbound messages; Tencent's msgid for
      outbound template messages. Indexed to dedupe webhook retries. */
  wechat_msg_id text,
  /** Full Tencent payload for debug/audit. Keep the raw XML parsed into
      a JSON object so future field additions don't need a migration. */
  raw_payload jsonb,
  status text not null default 'received'
    check (status in ('received', 'sent', 'failed', 'queued')),
  /** Failure detail when status='failed'. */
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wechat_messages_openid
  on public.wechat_messages(oa_account_id, openid, created_at desc);
create index if not exists idx_wechat_messages_contact
  on public.wechat_messages(contact_id, created_at desc)
  where contact_id is not null;
create unique index if not exists uniq_wechat_messages_tencent_msgid
  on public.wechat_messages(oa_account_id, wechat_msg_id)
  where wechat_msg_id is not null;

comment on table public.wechat_messages is
  'Per-OA WeChat message log. Separate from sms_messages / '
  'email_messages because WeChat has channel-specific fields '
  '(msg_type, event_type, openid, template_id) and conflating them '
  'onto sms_messages would force those columns onto every SMS row. A '
  'future "channel_messages" view can unify the three for the inbox UI '
  'without requiring a schema rewrite.';
comment on column public.wechat_messages.wechat_msg_id is
  'Tencent MsgId — unique per (OA, message). The partial unique index '
  'on (oa_account_id, wechat_msg_id) is how we dedupe the occasional '
  'Tencent webhook retry without needing app-level idempotency keys.';
