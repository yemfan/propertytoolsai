# Legacy migrations — reference only, do not run

These migration files target the pre-rename schema where the
`contacts` table was called `leads` (bigint primary key) and the
column was `lead_id`. After the leads→contacts cluster migration
(commit `3ded327f`), `leads` became a **view aliasing contacts**
and the canonical column name became `contact_id` (uuid).

Running any file in this folder against the live database now
fails with `42809: referenced relation "leads" is not a table`,
because PostgreSQL doesn't allow foreign keys to point at views.

The replacements live alongside this folder as forward-dated files
named after the live tables they create — see
`20260530000000_column_drift_catchup.sql` and the cluster of
migrations from late April / early May 2026 that the schema
audit applied via the Supabase MCP.

If you need to recover the historical schema or trace the
provenance of a column, read these files. **Do not run them.**

The CI guard at `scripts/ci/check-no-leads-refs.mjs` (added with
the same PR that created this folder) prevents new `from("leads")`
or `lead_id` references from being introduced in TypeScript code
going forward.
