-- Week 16: Client portal access token
-- ─────────────────────────────────────────────────────────────────────────────
-- Each client gets a unique portal_token UUID. Clients visit /portal/[token]
-- to view their invoices and estimates — no login required.
-- Regenerating the token (update portal_token = gen_random_uuid()) invalidates
-- the old link immediately.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Unique constraint + fast lookup by token
CREATE UNIQUE INDEX IF NOT EXISTS clients_portal_token_idx ON clients (portal_token);
