// @helm/data — canonical Supabase access for HelmSmart Core (single source of truth).
// Server (RLS-enforced, default):    import { createClient } from "@helm/data/server"
// Server (service-role, restricted): import { createServiceClient } from "@helm/data/server"
// Browser:                           import { createClient } from "@helm/data/client"
// Generated DB types:                import type { Database } from "@helm/data/types"
//
// Core package: MUST NOT import @helm/pack-* or apps/*.
// Clients are intentionally untyped for now (parity with smbai's pre-extraction clients).
// Opt into typing per-call: createClient().from(...) -> or use Database for typed repos.
// Regenerate types: supabase gen types typescript --project-id vpmwsnoosuiknyzdxgtk.
export type { Database, Json } from "./database.types";
