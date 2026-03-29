import { createClient } from "@supabase/supabase-js";

// Avoid hard-failing during `next build` when env vars are not set.
// Routes that actually need Supabase should still handle auth/query errors at runtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dummyServiceKey = "DUMMY_SUPABASE_SERVICE_ROLE_KEY";

export const supabaseServer = createClient(
  supabaseUrl ?? "http://localhost",
  serviceKey ?? dummyServiceKey
);

