-- Week 13: Report-optimised indexes
-- ─────────────────────────────────────────────────────────────────────────────
-- These indexes speed up the P&L and cash-flow queries used on the Reports page.

-- Journal entries sorted by date (P&L date range scans)
CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries (organization_id, date DESC);

-- Invoices by status + issue_date (revenue report filters)
CREATE INDEX IF NOT EXISTS idx_invoices_status_issued
  ON invoices (organization_id, status, issue_date DESC);

-- Bank transactions by date (cash flow report)
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date
  ON bank_transactions (organization_id, date DESC);
