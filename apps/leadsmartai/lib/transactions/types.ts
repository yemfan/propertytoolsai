/**
 * Shared types for the transaction coordinator feature.
 *
 * DB row shapes live here so the service + API layers don't duplicate
 * the same text. UI-only types (form state, component props) stay
 * with the components that use them.
 */

export type TransactionType = "buyer_rep" | "listing_rep" | "dual";
export type TransactionStatus = "active" | "closed" | "terminated" | "pending";
export type TransactionStage =
  | "contract"
  | "inspection"
  | "appraisal"
  | "loan"
  | "closing";

export type CounterpartyRole =
  | "title"
  | "lender"
  | "inspector"
  | "insurance"
  | "co_agent"
  | "other";

export type TaskSource = "seed" | "custom";

export type TransactionRow = {
  id: string;
  agent_id: string;
  contact_id: string;

  transaction_type: TransactionType;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchase_price: number | null;

  status: TransactionStatus;
  terminated_reason: string | null;

  /** Optional second anchor for listing-rep tasks (RLA signed / listing active). */
  listing_start_date: string | null;
  mutual_acceptance_date: string | null;
  inspection_deadline: string | null;
  inspection_completed_at: string | null;
  appraisal_deadline: string | null;
  appraisal_completed_at: string | null;
  loan_contingency_deadline: string | null;
  loan_contingency_removed_at: string | null;
  closing_date: string | null;
  closing_date_actual: string | null;

  /**
   * Commission fields. Written by applyCommissionDefaults at create + on
   * active → closed + on purchase_price change. Manual overrides from the
   * agent are preserved (the helper fills in nulls only).
   */
  commission_pct: number | null;
  gross_commission: number | null;
  brokerage_split_pct: number | null;
  referral_fee_pct: number | null;
  agent_net_commission: number | null;

  /** Weekly seller-update email opt-in. Only meaningful on listing_rep / dual. */
  seller_update_enabled: boolean;
  seller_update_last_sent_at: string | null;

  notes: string | null;

  created_at: string;
  updated_at: string;
};

export type TransactionTaskRow = {
  id: string;
  transaction_id: string;
  stage: TransactionStage;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  order_index: number;
  seed_key: string | null;
  source: TaskSource;
  created_at: string;
  updated_at: string;
};

export type TransactionCounterpartyRow = {
  id: string;
  transaction_id: string;
  role: CounterpartyRole;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Denormalized view the list page renders — each transaction plus a
 * task-completion counter. Built server-side so the list doesn't have
 * to N+1 over the per-transaction task tables.
 */
export type TransactionListItem = TransactionRow & {
  contact_name: string | null;
  task_total: number;
  task_completed: number;
  task_overdue: number;
};
