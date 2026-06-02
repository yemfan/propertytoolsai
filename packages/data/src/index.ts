// @helm/data — canonical Supabase access for HelmSmart Core (single source of truth).
// Server (RLS-enforced, default):    import { createClient } from "@helm/data/server"
// Server (service-role, restricted): import { createServiceClient } from "@helm/data/server"
// Browser:                           import { createClient } from "@helm/data/client"
//
// Core package: MUST NOT import @helm/pack-* or apps/*.
// TODO(phase1-followup): generate DB types (supabase gen types -> ./database.types.ts)
//   and parametrize the clients with <Database> for end-to-end type safety.
export {};
