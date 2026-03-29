-- Support chat tables for Supabase Postgres (snake_case).
-- Uses native ENUM types so Prisma enums match the database (see prisma/schema.prisma).
-- If you prefer plain TEXT columns instead of ENUMs, run the block at the bottom of this file
-- and use `npx prisma db pull` to realign the Prisma schema (enums become String).
-- Run in Supabase SQL Editor or: supabase db push / supabase migration up

-- gen_random_uuid() is available on Supabase; enable if your project is minimal:
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (labels must match prisma/schema.prisma enums exactly)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "SupportStatus" AS ENUM (
    'open',
    'waiting_on_support',
    'waiting_on_customer',
    'resolved',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SupportPriority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageSender" AS ENUM (
    'customer',
    'support',
    'system',
    'ai'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SupportMessageType" AS ENUM (
    'text',
    'system_event',
    'attachment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_user_id uuid NULL,
  subject text NULL,

  status "SupportStatus" NOT NULL DEFAULT 'open',
  priority "SupportPriority" NOT NULL DEFAULT 'normal',

  assigned_agent_id text NULL,
  assigned_agent_name text NULL,

  source text NULL DEFAULT 'website_chat',
  last_message_at timestamptz NULL,
  last_message_by "MessageSender" NULL,

  unread_for_customer integer NOT NULL DEFAULT 0,
  unread_for_support integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,

  sender_type "MessageSender" NOT NULL,
  sender_name text NULL,
  sender_email text NULL,

  body text NOT NULL,
  message_type "SupportMessageType" NOT NULL DEFAULT 'text',
  is_internal_note boolean NOT NULL DEFAULT false,
  metadata jsonb NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_support_conversations_email
  ON support_conversations(customer_email);

CREATE INDEX IF NOT EXISTS idx_support_conversations_status
  ON support_conversations(status);

CREATE INDEX IF NOT EXISTS idx_support_conversations_assigned_agent
  ON support_conversations(assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_support_conversations_last_message_at
  ON support_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_created
  ON support_messages(conversation_id, created_at);

/*
  ---------------------------------------------------------------------------
  Reference: original TEXT-column DDL (do not run if you already applied above)
  ---------------------------------------------------------------------------
  create table if not exists support_conversations (
    id uuid primary key default gen_random_uuid(),
    public_id text unique not null,
    customer_name text not null,
    customer_email text not null,
    customer_user_id uuid null,
    subject text null,
    status text not null default 'open',
    priority text not null default 'normal',
    assigned_agent_id text null,
    assigned_agent_name text null,
    source text null default 'website_chat',
    last_message_at timestamptz null,
    last_message_by text null,
    unread_for_customer integer not null default 0,
    unread_for_support integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists support_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references support_conversations(id) on delete cascade,
    sender_type text not null,
    sender_name text null,
    sender_email text null,
    body text not null,
    message_type text not null default 'text',
    is_internal_note boolean not null default false,
    metadata jsonb null,
    created_at timestamptz not null default now()
  );

  create index if not exists idx_support_conversations_email
    on support_conversations(customer_email);
  create index if not exists idx_support_conversations_status
    on support_conversations(status);
  create index if not exists idx_support_conversations_last_message_at
    on support_conversations(last_message_at desc);
  create index if not exists idx_support_messages_conversation_created
    on support_messages(conversation_id, created_at);
*/
