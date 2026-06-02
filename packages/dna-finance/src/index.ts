// @helm/dna-finance — Finance DNA: invoices, expenses, bills, estimates, double-entry ledger.
// Canonical bookkeeping is smbai's double-entry model (CDR-001). Pure, org-scoped logic;
// the app owns the "use server" + orchestration (email/notifications/automations/revalidate).
//
// Core package: MUST NOT import @helm/pack-* or apps/*. Depends only on @helm/data + @supabase.
export * from "./money";
export * from "./invoices";
export * from "./expenses";
