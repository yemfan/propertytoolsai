-- ============================================================
-- Migration 00037: Realtime for messages
-- ============================================================
-- Adds the messages table to the supabase_realtime publication so the
-- inbox receives new inbound/outbound messages live (no manual refresh).
-- Idempotent — safe to run even if the table is already published.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
