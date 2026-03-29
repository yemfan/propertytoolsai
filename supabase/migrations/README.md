# Supabase migrations (repo root)

**Incremental plan:** SQL migrations currently live under `apps/leadsmartai/supabase/migrations/` and remain the source of truth until you consolidate here.

Use this folder for:

- New cross-app or shared migrations
- Supabase CLI project root when you point `config.toml` at the monorepo root

Moving existing files in one step risks deploy drift; copy or re-path in a dedicated migration PR.
