// Canonical Supabase access now lives in @helm/data (single source of truth).
// This thin re-export keeps the ~120 importers of "@/lib/supabase/server" working
// unchanged while the implementation is owned by HelmSmart Core.
export { createClient, createServiceClient } from "@helm/data/server";
