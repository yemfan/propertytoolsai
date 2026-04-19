import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Click-through redirect for listing alert emails. The digest email
 * embeds URLs of the form:
 *   /api/alerts/click?s=<saved_search_id>&l=<listing_id>&to=<path>
 *
 * Logs a listing_alert_clicked event (so the scoring cron sees the
 * engagement — +5 weight) then 302s to the destination path. The path
 * is validated to start with "/" so a stale link can't redirect to an
 * attacker-controlled URL.
 *
 * Firing the event is fire-and-forget: we never block the redirect on
 * a DB write. Worst case the user clicks through without the event
 * landing; the listing page view itself is still tracked by
 * propertytoolsai's own instrumentation.
 */

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://www.propertytoolsai.com";

function sanitizeRedirect(to: string | null): string {
  if (!to || !to.startsWith("/")) return "/search";
  // Disallow protocol-relative // redirects.
  if (to.startsWith("//")) return "/search";
  return to;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const savedSearchId = url.searchParams.get("s");
  const listingId = url.searchParams.get("l");
  const to = sanitizeRedirect(url.searchParams.get("to"));
  const target = new URL(to, PUBLIC_BASE_URL).toString();

  if (savedSearchId) {
    // Fire-and-forget — never block the redirect.
    void (async () => {
      try {
        const { data: search } = await supabaseAdmin
          .from("contact_saved_searches")
          .select("contact_id,agent_id")
          .eq("id", savedSearchId)
          .maybeSingle();
        const row = search as { contact_id?: string; agent_id?: unknown } | null;
        if (row?.contact_id) {
          await supabaseAdmin.from("contact_events").insert({
            contact_id: row.contact_id,
            agent_id: (row.agent_id ?? null) as never,
            event_type: "listing_alert_clicked",
            source: "email",
            payload: {
              saved_search_id: savedSearchId,
              listing_id: listingId,
            } as never,
          } as never);
        }
      } catch (e) {
        console.error("[alerts/click] event log failed", e);
      }
    })();
  }

  return NextResponse.redirect(target, 302);
}
