# Splitting `listings` from `transactions` — Design Doc

**Status:** ✅ signed off 2026-05-09 — Phase 1 starting
**Author:** Claude (planning), Michael (decision)
**Date:** 2026-05-09
**PRs that will land under this doc:** PR #366 (this doc), Phase 1 PR forthcoming

## Locked-in decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Polymorphic FKs vs dual columns (crm_tasks, signature_envelopes) | **Dual columns + CHECK constraint** (Claude rec) |
| 2 | Back-link from transaction → source listing | **Yes — `transactions.source_listing_id` nullable FK** (Claude rec) |
| 3 | `closing_date` ownership | **Transactions only** (Claude rec). Pure listing-rep deals spawn a transaction at acceptance; listings carry no closing fields. |
| 4 | Coordinator scope | **No listings coordinator.** Coordinator stays a transactions-only feature (user direction). |
| 5 | Dual-rep representation | **Two rows: a listing AND a separate offer.** Listing is treated identically to any other listing. The offer tracks the dual-rep buyer-side. When accepted → transaction with `type='dual'` AND listing flips to `contracted` AND `transactions.source_listing_id` points back. (user direction) |

## TL;DR

Today, **listings live as rows in the `transactions` table** with `transaction_type = 'listing_rep'` (or `'dual'`). The shared design has held us back as the UI tried to be both a listing manager and a deal manager from the same entity. We've patched the symptoms (PRs #363 #364 #365) but the underlying mental-model bleed will keep returning.

This doc proposes splitting `listings` into its own first-class table, with a **clean lifecycle hand-off** when an offer is accepted — listing → transaction is a real state transition, not a discriminator flip. Migration is phased to ship without big-bang risk.

## Why now (not "when it hurts")

- Today: ~hundreds of listing-rep rows total
- Tomorrow at thousands of users × ~5 listings each: ~50,000 listing-rep rows mixed in with transactions
- Every listing query today is `WHERE agent_id = ? AND transaction_type IN ('listing_rep','dual')` — a filter that pollutes the query plan and shows up in every analytics surface forever
- The longer we wait, the more code paths bake in the shared assumption (today: 101 references to `transaction_type` across the codebase)

The decision **at scale** isn't "shared vs split"; it's "split the table, or live with a polymorphic discriminator forever." Now is when the cost is lowest.

---

## Current state — what we're working from

### Schema today
```
transactions
├── id (uuid, PK)
├── agent_id, contact_id (FKs)
├── transaction_type ∈ ('buyer_rep', 'listing_rep', 'dual')
├── property_address, city, state, zip
├── purchase_price                ← list price for listing_rep, agreed price for buyer_rep
├── status ∈ ('active','closed','terminated','pending')
├── mutual_acceptance_date        ← null on a fresh listing
├── inspection_deadline, appraisal_deadline, loan_contingency_deadline
├── inspection_completed_at, appraisal_completed_at, loan_contingency_removed_at
├── closing_date, closing_date_actual
├── listing_start_date            ← non-null on listing_rep + dual; null on buyer_rep
├── commission_pct, gross_commission, brokerage_split_pct, referral_fee_pct, agent_net_commission
├── seller_update_enabled, seller_update_last_sent_at  ← listing-only
└── notes, created_at, updated_at
```

### Tables that FK to `transactions.id` (18 FKs across 8 feature tables)
- `transaction_tasks` (cascade)
- `transaction_counterparties` (cascade)
- `crm_tasks.transaction_id` (set null)
- `offers.transaction_id` (set null) — back-link from accepted offers
- `listing_offers.transaction_id` (cascade) — listing-side offer aggregator
- `open_houses.transaction_id` (set null)
- `transaction_reviews.transaction_id` (cascade)
- `listing_feedback.transaction_id` (cascade)
- `agent_social_connections.transaction_id` (set null)
- `signature_envelopes.transaction_id`

### Code surface area
- `lib/transactions/*` — service, types, seedTasks, deadlineDefaults
- `lib/listings/service.ts` — already exists, queries transactions WHERE type∈('listing_rep','dual')
- `lib/listing-feedback/service.ts` — gates on `transaction_type IN ('listing_rep','dual')`
- `lib/deal-review/gatherSnapshot.ts` — branches on type
- 101 total references to `transaction_type` / `transactionType` in TS/TSX/SQL
- 8 references to `transaction_type === 'listing_rep'` specifically

### UI surface
- `/dashboard/transactions` — buyer + listing + dual rows
- `/dashboard/properties` (alias "Listings") — listing_rep + dual rows
- `/dashboard/transactions/[id]` — detail page used by **both**
- `/dashboard/transactions/[id]/offers` — gated to listing_rep + dual only

---

## Target state

### Two tables, one shared lifecycle moment

```
┌──────────────────┐                         ┌──────────────────┐
│   listings       │                         │  transactions    │
│  (pre-mutual     │      offer accepted     │  (post-mutual    │
│   acceptance)    │  ──────────────────▶    │   acceptance)    │
└──────────────────┘   listing.transaction_id└──────────────────┘
       ↑                                              ↑
       │                                              │
   showings, listing_offers, listing_feedback     transaction_tasks,
   (listing-only)                                 counterparties, offers (back-link),
                                                  open_houses (post-acceptance)
```

### `listings` table (new)

Columns that make sense pre-acceptance only:

```
listings
├── id (uuid, PK)
├── agent_id, contact_id (FKs)             ← contact_id = seller
├── property_address, city, state, zip, mls_number, mls_url
├── list_price                             ← single source of truth pre-acceptance
├── listing_start_date                     ← RLA signed / MLS go-live
├── listing_end_date                       ← contractual expiry from RLA
├── status ∈ ('draft','active','pending','withdrawn','expired','contracted')
│       ├── draft       = RLA being prepared
│       ├── active      = on MLS, taking showings
│       ├── pending     = under contract (buyer's offer accepted)
│       ├── withdrawn   = pulled before expiry
│       ├── expired     = RLA hit listing_end_date
│       └── contracted  = pending offer is now a transaction (back-link set)
├── transaction_id (uuid, nullable, FK)    ← set when offer accepted; back-link to the buyer_rep+listing_rep transaction
├── days_on_market                         ← computed; lives here pre-acceptance
├── commission_pct                         ← listing-side commission baseline
├── seller_update_enabled, seller_update_last_sent_at
├── notes, created_at, updated_at
```

**Note:** the `dual` case is two rows — one in `listings` (representing the seller side) and one in `transactions` once the offer is mutual-accepted. They link via `listings.transaction_id`. Reports treat them as one deal via the join.

### `transactions` table (slimmed)

Drop `listing_start_date`, `seller_update_enabled`, `seller_update_last_sent_at`. Drop `transaction_type = 'listing_rep'` from the check constraint (only `'buyer_rep'` and `'dual'` remain). All other columns stay.

### Cross-table FK changes

| Table | Today | After |
| --- | --- | --- |
| `listing_offers.transaction_id` | → transactions(id) | → **listings(id)** (rename to `listing_id`) |
| `listing_feedback.transaction_id` | → transactions(id) | → **listings(id)** (rename to `listing_id`) |
| `open_houses.transaction_id` | → transactions(id) | → **listings(id)** (rename to `listing_id`) |
| `offers.transaction_id` | → transactions(id) | unchanged (offers always back-link to the post-acceptance transaction) |
| `transaction_tasks.transaction_id` | → transactions(id) | unchanged |
| `transaction_counterparties.transaction_id` | → transactions(id) | unchanged |
| `crm_tasks.transaction_id` | → transactions(id) | **polymorphic**: rename to `target_id` + add `target_kind` ∈ ('listing','transaction') OR keep as transaction_id only and add separate `crm_tasks.listing_id` |
| `signature_envelopes.transaction_id` | → transactions(id) | **polymorphic** (RLA on listings, RPA on transactions) |

**Decision required:** for `crm_tasks` and `signature_envelopes`, do we go (a) two columns `listing_id` + `transaction_id` with a CHECK constraint that exactly one is non-null, or (b) `target_kind` + `target_id` polymorphic? **Recommend (a)** — Postgres FK enforcement is explicit and queries stay readable.

### Lifecycle hand-off — listing → transaction

When the seller accepts a buyer's offer:

1. Listing's `status = 'pending'` → `'contracted'`
2. New transaction inserted with `transaction_type = 'listing_rep'` (or `'dual'`), copying property + parties + commission fields
3. Offer's `transaction_id` set to the new transaction
4. Listing's `transaction_id` set to the new transaction
5. Listing-side seed tasks complete; transaction-side seed tasks fire

This is a real promotion event, not a column flip. Audit trail is clean (listing row preserved with its showings history; transaction row owns the post-acceptance lifecycle).

---

## Migration plan

### Phase 0 — design signoff (this doc)
*No code, no migration. Read this doc, push back, lock the design.*

### Phase 1 — schema, dual-write, no read change *(week 1)*

1. **Migration A** — `create table public.listings (...)`, with all columns, RLS, indexes
2. **Migration B** — backfill listings from `transactions WHERE transaction_type IN ('listing_rep','dual')`. **Source rows kept in place.** New `listings.transaction_id` points back to the source transaction so legacy code keeps working.
3. **Migration C** — `alter table listing_offers rename column transaction_id to source_id_legacy; add column listing_id uuid references listings(id); backfill listing_id from source_id_legacy via the listings.transaction_id mapping`. Same for `listing_feedback`, `open_houses`.
4. Service layer change in `lib/listings/service.ts`: keep the old `select from transactions` path as fallback, add new `select from listings` path behind a feature flag.
5. **Read path unchanged**. Legacy code still works.

**Risk:** dual-write inconsistency between `transactions WHERE type='listing_rep'` rows and the new `listings` rows. Mitigated by a post-migration consistency check in CI: every listing has a matching transaction; every listing_rep transaction has a matching listing.

### Phase 2 — cutover reads *(week 2)*

1. Flip `lib/listings/service.ts` to read from `listings` table primarily
2. `/dashboard/properties` reads from listings
3. **New `/dashboard/listings/[id]` detail page** (clean chrome — "Listing details," not "Transaction details")
4. `/dashboard/transactions/[id]` stays for the buyer-rep + post-acceptance listing-rep deals; loses the listing-rep-specific chrome
5. Existing listing-rep transactions where `transaction_type='listing_rep'` and `mutual_acceptance_date IS NULL` get **deleted** (their data lives in listings now). Listing-rep transactions where `mutual_acceptance_date IS NOT NULL` stay (they're contracted deals).
6. `transaction_type` check constraint relaxes to `('buyer_rep', 'listing_rep', 'dual')` still — listing_rep rows in transactions now mean "post-acceptance listing-side deal," not "active listing"

**Backwards-compat:** all old `/dashboard/transactions/<listing_id>` URLs in emails / screenshots / external bookmarks are redirected to `/dashboard/listings/<listing_id>` via a Next.js rewrite.

### Phase 3 — clean up *(week 3)*

1. Drop `listings.transaction_id` legacy column (replaced by clean lifecycle promotion)
2. Drop `transactions.listing_start_date`, `seller_update_*` columns (now live on listings)
3. Drop fallback code in `lib/listings/service.ts`
4. Update the 101 `transaction_type` references — most just go away when the listing-side code paths move to `lib/listings/`
5. Reports / coordinator boards update to UNION listings + transactions where they want to show "all deals"

### Phase 4 — polish *(week 4 if needed)*

- Listings dashboard with listing-side analytics (showings activity, days on market, price reductions, marketing performance)
- Lifecycle visualization on the listing detail page (RLA → MLS → showings → offers → mutual acceptance → escrow → close)

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Inconsistent dual-write during Phase 1 | High | Medium | Consistency-check job in CI; fix-up migration if drift detected |
| Old URLs break (`/dashboard/transactions/<id>` for a listing) | Certain | Low | Next.js rewrite catches the legacy ID and 301s to `/dashboard/listings/<id>` |
| Listing-rep checklists don't fire on the right table | High | High | Phase 2 includes a careful re-test of seedTasks for both pre- and post-acceptance |
| Reports / commission-YTD misses post-acceptance listing-rep deals (now in transactions) | Medium | High | Unit-test reports against fixture data covering both tables |
| Dual-agent rows confuse the join | Medium | Medium | Dual-rep deals get a row in listings AND a row in transactions linked via `listings.transaction_id` |
| Migration locks transactions table during big backfill | Medium | High | Backfill in batches with `LIMIT 1000`; or use a `pg_repack`-style background fill |
| Code reviewers miss a `WHERE transaction_type='listing_rep'` query | High | Medium | Phase 1 lints — `eslint-plugin-no-restricted-syntax` rule against `transaction_type === "listing_rep"` outside `lib/listings/` |
| RLS policies drift between the two tables | Medium | High | Each migration includes RLS; CI test harness asserts agent A can't read agent B's listings/transactions |

---

## Open questions (decisions needed before Phase 1)

1. **Polymorphic FKs vs dual columns** for `crm_tasks` and `signature_envelopes`. Recommend dual columns + CHECK constraint. ✅ default unless you object.
2. **Does the post-acceptance listing-rep transaction keep a back-link to its source listing?** Recommend yes (`transactions.source_listing_id` nullable) so the detail page can show "this deal originated from listing X." ✅ default unless you object.
3. **What happens to `closing_date` on a listing?** Today `transactions.closing_date` is used both pre- and post-acceptance. Proposal: listings drop closing fields entirely (a listing without an accepted offer has no closing); the transaction owns closing. ✅ default unless you object.
4. **Coordinator board** (`/dashboard/transactions/coordinator`) — does it show listings too? Today it shows everything. Proposal: listings get their own coordinator at `/dashboard/listings/coordinator`; transactions coordinator shows only post-acceptance deals. Open for discussion.
5. **Dual-rep edge case** — when both sides are the same agent, do we want one record or two? Two is more honest about the data but harder to reason about. Recommend two with FK link.

---

## What I'm NOT proposing (out of scope)

- Renaming `transactions` → `deals` or anything similar
- Changing the offer → transaction flow that landed in PR #359
- Multi-state / per-state seedTasks (separate doc, larger scope)
- Splitting `contacts` into buyers/sellers (no — same person can be both)

---

## Test strategy

### Phase 1 acceptance
- `pnpm test` passes; new tests for `lib/listings/service.ts` reading from listings table
- Backfill produces `count(listings) = count(transactions WHERE type IN ('listing_rep','dual'))`
- Every listing has a non-null `transaction_id` pointing at its source transaction
- RLS: agent A query against listings returns only their own rows

### Phase 2 acceptance
- Manual walkthrough: agent creates listing → showings → offers → accepts → transaction created → both rows linked
- All E2E tests pass (`pnpm --filter leadsmartai test:e2e`)
- Old URL `/dashboard/transactions/<listing_id>` 301s to `/dashboard/listings/<listing_id>`
- No broken links from `/dashboard/properties` rows
- Commission-YTD report includes both pre- and post-acceptance listing-side deals

### Phase 3 acceptance
- All 101 `transaction_type` references either resolved or properly scoped
- `listings.transaction_id` legacy column removed
- No code path references `transaction_type = 'listing_rep'` outside the lifecycle promotion logic

---

## Effort estimate

- **Phase 0** (design signoff): 0.5 day — *blocking on user review of this doc*
- **Phase 1** (schema, dual-write): 3-4 days
- **Phase 2** (cutover reads, new detail page): 5-6 days
- **Phase 3** (cleanup): 2-3 days
- **Phase 4** (polish, optional): 2-3 days

**Total ~2-3 weeks of focused engineering** — matches the early estimate. Ships incrementally; no single PR is risky.

---

## Decision needed from you

Please reply with:
1. **Go / no-go on overall plan**
2. **Decisions on open questions 1-5** (or "go with defaults")
3. **Anything I missed in the inventory**
4. **Phasing — happy with 4 phases or prefer fewer/more?**

Once you sign off, I'll start Phase 1 with a single PR that's just the schema migration + backfill + consistency check. No reads change. Easy to revert.
