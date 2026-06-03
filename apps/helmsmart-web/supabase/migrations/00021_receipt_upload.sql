-- Week 23: Expense receipt attachment
-- Expenses live in journal_entries (source_type = 'expense'), not a separate table.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS receipt_url       TEXT,
  ADD COLUMN IF NOT EXISTS receipt_filename  TEXT;

-- Supabase Storage bucket for receipts (created via dashboard or CLI)
-- bucket name: "receipts"  (public: false)
-- The app reads/writes via the service role client.
