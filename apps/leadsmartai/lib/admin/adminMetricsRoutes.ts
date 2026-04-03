import { NextResponse } from "next/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";

/** Founder/admin metrics use the service-role client; without it, PostgREST calls fail. */
export function adminMetricsServiceUnavailable(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error:
        "Admin metrics require SUPABASE_SERVICE_ROLE_KEY on the server. In Vercel → Project → Settings → Environment Variables, add the service role JWT from Supabase → Project Settings → API (never expose it to the client). Redeploy after saving.",
    },
    { status: 503 }
  );
}

export function adminMetricsErrorResponse(
  logLabel: string,
  e: unknown,
  userMessage: string
): NextResponse {
  console.error(logLabel, e);
  const details = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ success: false, error: userMessage, details }, { status: 500 });
}

export function requireAdminMetricsSupabase(): NextResponse | null {
  if (!isSupabaseServiceConfigured()) {
    return adminMetricsServiceUnavailable();
  }
  return null;
}
