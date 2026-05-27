-- ============================================================
-- Migration 00003: Bank feeds (Plaid integration)
-- ============================================================
-- Tables: bank_connections → bank_accounts → bank_transactions
-- All org-scoped with RLS via get_user_org_ids().
--
-- Plaid access tokens are stored AES-256-GCM encrypted
-- (plaid_access_token_enc).  Never stored in plaintext.
-- ============================================================

-- ── bank_connections ──────────────────────────────────────────────────────────
-- One row per Plaid Item (a user login at an institution).
-- An item can contain multiple accounts.

CREATE TABLE IF NOT EXISTS bank_connections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plaid_item_id           text        NOT NULL UNIQUE,
  plaid_access_token_enc  text        NOT NULL,   -- AES-256-GCM encrypted, never plaintext
  institution_id          text,
  institution_name        text,
  status                  text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'error', 'disconnected')),
  -- Incremental sync cursor (Plaid /transactions/sync)
  cursor                  text,
  last_synced_at          timestamptz,
  error_code              text,       -- Plaid error code when status = 'error'
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_connections_org_id_idx
  ON bank_connections(organization_id);

-- ── bank_accounts ─────────────────────────────────────────────────────────────
-- Individual accounts (checking, savings, credit card, etc.) within a connection.

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id       uuid        NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  plaid_account_id    text        NOT NULL UNIQUE,
  name                text        NOT NULL,
  official_name       text,
  type                text        NOT NULL,   -- 'depository' | 'credit' | 'investment' | 'loan' | 'other'
  subtype             text,                   -- 'checking' | 'savings' | 'credit card' | etc.
  mask                text,                   -- last 4 digits
  current_balance     numeric(14,2),
  available_balance   numeric(14,2),
  iso_currency_code   text        NOT NULL DEFAULT 'USD',
  is_active           boolean     NOT NULL DEFAULT true,
  -- Link to chart_of_accounts so transactions auto-debit/credit the right account
  coa_account_id      uuid        REFERENCES chart_of_accounts(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_accounts_org_id_idx      ON bank_accounts(organization_id);
CREATE INDEX IF NOT EXISTS bank_accounts_connection_idx  ON bank_accounts(connection_id);

-- ── bank_transactions ─────────────────────────────────────────────────────────
-- Raw transactions imported from Plaid.
-- Plaid sign convention: positive amount = money OUT of account (spend/debit).

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id                  uuid        NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  plaid_transaction_id        text        NOT NULL UNIQUE,
  -- Amount in Plaid convention (positive = debit/spend, negative = credit/income)
  amount                      numeric(14,2) NOT NULL,
  iso_currency_code           text        NOT NULL DEFAULT 'USD',
  date                        date        NOT NULL,
  authorized_date             date,
  name                        text        NOT NULL,   -- Plaid raw name
  merchant_name               text,
  -- Categories (Plaid v3 personal finance category takes precedence)
  personal_finance_category   text,       -- e.g. "FOOD_AND_DRINK"
  personal_finance_category_detail text,  -- e.g. "RESTAURANTS"
  category_legacy             text[],     -- Plaid v2 category hierarchy (deprecated but still useful)
  pending                     boolean     NOT NULL DEFAULT false,
  plaid_pending_transaction_id text,      -- set when this txn was previously pending
  -- AI-assisted categorisation
  coa_account_id              uuid        REFERENCES chart_of_accounts(id),
  ai_category_confidence      numeric(4,3) CHECK (ai_category_confidence BETWEEN 0 AND 1),
  ai_suggested_memo           text,
  -- Human review
  reviewed                    boolean     NOT NULL DEFAULT false,
  memo                        text,
  -- Double-entry ledger link (set when the transaction has been posted)
  journal_entry_id            uuid        REFERENCES journal_entries(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_transactions_org_id_idx     ON bank_transactions(organization_id);
CREATE INDEX IF NOT EXISTS bank_transactions_account_idx    ON bank_transactions(account_id);
CREATE INDEX IF NOT EXISTS bank_transactions_date_idx       ON bank_transactions(date DESC);
CREATE INDEX IF NOT EXISTS bank_transactions_unreviewed_idx
  ON bank_transactions(organization_id, reviewed)
  WHERE reviewed = false;

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at_bank_connections
  BEFORE UPDATE ON bank_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_bank_accounts
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_bank_transactions
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE bank_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- bank_connections policies
CREATE POLICY "org members can select bank_connections"
  ON bank_connections FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can insert bank_connections"
  ON bank_connections FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can update bank_connections"
  ON bank_connections FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can delete bank_connections"
  ON bank_connections FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- bank_accounts policies
CREATE POLICY "org members can select bank_accounts"
  ON bank_accounts FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can insert bank_accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can update bank_accounts"
  ON bank_accounts FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can delete bank_accounts"
  ON bank_accounts FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- bank_transactions policies
CREATE POLICY "org members can select bank_transactions"
  ON bank_transactions FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can insert bank_transactions"
  ON bank_transactions FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can update bank_transactions"
  ON bank_transactions FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- Transactions cannot be deleted (hard-delete; use journal reversal for corrections)
-- DELETE policy intentionally omitted for bank_transactions.
