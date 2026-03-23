-- Support chat (Supabase / Postgres). See apps/leadsmart-ai/supabase/migrations for duplicate.
-- Native ENUM types match prisma/schema.prisma enums.

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
