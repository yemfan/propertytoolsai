# Contact intake (LeadSmart)

Unified pipeline for **manual entry**, **CSV import**, and **business card scan** (review required before CRM save).

## Pipeline (all methods)

Every contact flows through:

1. **Normalization** — `normalized_email`, `normalized_phone`, `normalized_address`, `contact_completeness_score` via `normalizeLeadFields` in `lib/contact-enrichment/service.ts` (shared with cleanup tools).
2. **Duplicate detection** — same scoring rules as `lib/contact-enrichment/dedupe.ts` (email/phone/address/name signals; threshold ≥ 50). Indexed lookups on `leads.normalized_*` where present.
3. **Enrichment** — optional OpenAI enrichment via `enrichLeadRecord` (`lib/contact-enrichment/enrichment.ts`). Bulk CSV import skips per-row enrichment by default (`enrichRows: false`); turn on in finalize API if needed.
4. **CRM save** — inserts or updates `public.leads` with `intake_channel` + optional `import_job_id`.
5. **Activity logging** — `lead_events.event_type = 'contact_intake'` with metadata (`intake_channel`, `import_job_id`, merge/create flags).

Marketplace scoring: `runLeadMarketplacePipeline` after insert (same as `/api/leads/create`).

## Schema

Migration `20260470000000_contact_import_jobs.sql`:

- **`contact_import_jobs`** — batch metadata (`intake_channel`: `csv` | `business_card` | `manual_batch`), `column_mapping`, `duplicate_strategy`, `summary`, `scan_draft` (OCR placeholder payload).
- **`contact_import_rows`** — per-CSV-row staging (`raw_payload`, `normalized_payload`, `duplicate_lead_id`, `resolution`).
- **`leads.intake_channel`**, **`leads.import_job_id`** — optional attribution.

## API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/dashboard/contacts/intake` | Manual create (web modal / forms). `409` + `DUPLICATE_CANDIDATE` unless `forceCreate: true`. |
| `POST /api/dashboard/contacts/import/upload` | `multipart/form-data` field `file` — CSV only, max 5 MB / 10k rows. |
| `POST /api/dashboard/contacts/import/preview` | Body: `jobId`, `mapping`, `duplicateStrategy` — fills duplicate hints on rows. |
| `POST /api/dashboard/contacts/import/finalize` | Body: `jobId`, `duplicateStrategy`, optional `enrichRows`. |
| `GET /api/dashboard/contacts/import/history` | Last 50 jobs for the signed-in agent. |
| `POST /api/mobile/contacts/scan/draft` | OCR **placeholder** — stores `scan_draft`, returns suggested fields. **Does not create a lead.** |
| `POST /api/mobile/contacts/scan/finalize` | **Reviewed** fields + `jobId` — runs ingestion (`duplicateStrategy: merge` merges into an existing lead when matched). |

All dashboard routes require a logged-in agent (cookie session). Mobile routes use `requireMobileAgent` (Bearer or cookie).

## UI

- **Web:** Primary route is **`app/dashboard/leads/page.tsx`** — **New contact** (modal → `POST /api/dashboard/contacts/intake`), **Import CSV** (`/dashboard/leads/import`), **Add (full screen)** on small viewports (`/dashboard/leads/add`). (`LeadsClient.tsx` is an alternate table implementation and is not mounted by default.)
- **Mobile app / PWA:** call the mobile scan APIs; do not skip the finalize step.

### Validation (local)

- `npx eslint` on `lib/contact-intake/**`, `app/api/dashboard/contacts/**`, `app/api/mobile/contacts/**`, and dashboard leads pages.
- `npx tsx scripts/smoke-contact-intake.ts` — offline checks for Zod schema, dedupe scoring, OCR placeholder, Papa.parse (no Supabase).
- End-to-end requires DB migrations applied (`contact_import_jobs`) and authenticated agent session.

## OCR integration

Replace or extend `extractBusinessCardFieldsFromText` in `lib/contact-intake/businessCardOcr.ts`. You can pass `imageBase64` to `/api/mobile/contacts/scan/draft` for future server-side OCR; the draft job stores `scan_draft.hasImage` and raw text when provided.

## Duplicate handling (CSV)

- **skip** — rows with a strong duplicate match are not inserted.
- **merge** — non-empty fields from the row are merged into the matched lead (`mergeLeadRecords`).
- **create_anyway** — always insert a new lead (cleanup tools can reconcile later).

## Reliability notes

- Reuses existing **admin** duplicate + merge tooling concepts (`lead_duplicate_candidates`, merge API remains separate for manual resolution).
- For very large CSVs, consider background jobs (queue) — current implementation processes rows synchronously in the finalize request.
