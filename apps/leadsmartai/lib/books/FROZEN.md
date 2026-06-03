# ⛔ FROZEN — `leadsmartai/lib/books`

**Status:** Frozen 2026-06-02 (HelmSmart V2 refactor, Phase 0). **Do not add features here.**

**Why:** This bookkeeping module is a **duplicate** of `apps/helmsmart-web`'s implementation (Tech Debt D1). Per CDR-001 (Option D), **smbai's double-entry books win** as the canonical Finance DNA — they are a full general ledger (accounts, bills, estimates, journal, vendors, reports) vs this module's flatter invoices/expenses.

**Disposition:** This code becomes the source for `@helm/dna-finance` only where smbai lacks coverage; otherwise it is retired when Finance DNA lands (Extraction Plan reference slice A).

**Allowed:** critical bugfixes that keep the live leadsmartai app working.
**Not allowed:** new bookkeeping features, schema changes, or new callers — build those in `@helm/dna-finance`.

See `…/HelmSmart/Claude/Implementation_Plan_OptionD.md` (Part 3) and `Table_Classification_Report.md` (Finance duplicates).
