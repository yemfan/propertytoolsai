-- Animated e-postcards for sphere outreach.
--
-- Real-estate sphere outreach is dominated by plain-text "just
-- checking in" email that gets ignored. This introduces delightful
-- HTML/CSS-animated postcards the agent can send via email, SMS, or
-- WeChat (pending JV). Each send has a unique public slug; the link
-- opens a viewer page, the animation plays, agent's personal message
-- fades in, CTAs offer to call / text / reply.
--
-- Templates themselves live in TypeScript code — static, curated,
-- updated on deploy. We only persist sends.

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
      create table if not exists public.postcard_sends (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        -- Which curated template this send uses. Keys live in
        -- lib/postcards/templates.ts.
        template_key text not null,

        -- Public URL slug. 14 URL-safe chars → 62^14 keyspace = plenty
        -- even for heavy senders. Unique + indexed for the public GET.
        slug text not null unique,

        -- Denormalized recipient contact at send-time. Keeps the card
        -- correct even if the contact row is later edited.
        recipient_name text not null,
        recipient_email text,
        recipient_phone text,

        -- Agent's custom message rendered after the animation.
        -- NULL → use the template default copy.
        personal_message text,

        -- Channels requested at send time. Array of
        -- 'email' | 'sms' | 'wechat'. Delivery status per channel
        -- lives in separate timestamp columns below.
        channels text[] not null default array[]::text[],

        email_sent_at timestamptz,
        sms_sent_at timestamptz,
        wechat_sent_at timestamptz,
        email_error text,
        sms_error text,
        wechat_error text,

        -- First time the public viewer page was loaded. Stays null
        -- until the recipient opens the card.
        opened_at timestamptz,
        open_count integer not null default 0,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.postcard_sends (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        template_key text not null,
        slug text not null unique,

        recipient_name text not null,
        recipient_email text,
        recipient_phone text,

        personal_message text,
        channels text[] not null default array[]::text[],

        email_sent_at timestamptz,
        sms_sent_at timestamptz,
        wechat_sent_at timestamptz,
        email_error text,
        sms_error text,
        wechat_error text,

        opened_at timestamptz,
        open_count integer not null default 0,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_postcard_sends_agent_created
  on public.postcard_sends (agent_id, created_at desc);

create index if not exists idx_postcard_sends_contact
  on public.postcard_sends (contact_id, created_at desc)
  where contact_id is not null;

create index if not exists idx_postcard_sends_slug
  on public.postcard_sends (slug);
