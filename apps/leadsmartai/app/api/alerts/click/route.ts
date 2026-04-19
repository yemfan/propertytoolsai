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
  // `s` = saved_search_id (listing alert digest), `r` = recommendation_id
  // (agent-curated send). One query param is present depending on which
  // email fired the click.
  const savedSearchId = url.searchParams.get("s");
  const recommendationId = url.searchParams.get("r");
  const listingId = url.searchParams.get("l");
  const to = sanitizeRedirect(url.searchParams.get("to"));
  const target = new URL(to, PUBLIC_BASE_URL).toString();

  if (savedSearchId || recommendationId) {
    void (async () => {
      try {
        let contactId: string | undefined;
        let agentId: unknown = null;

        if (savedSearchId) {
          const { data } = await supabaseAdmin
            .from("contact_saved_searches")
            .select("contact_id,agent_id")
            .eq("id", savedSearchId)
            .maybeSingle();
          const row = data as { contact_id?: string; agent_id?: unknown } | null;
          contactId = row?.contact_id;
          agentId = row?.agent_id ?? null;
        } else if (recommendationId) {
          const { data } = await supabaseAdmin
            .from("agent_property_recommendations")
            .select("contact_id,agent_id,first_clicked_at,click_count")
            .eq("id", recommendationId)
            .maybeSingle();
          const row = data as {
            contact_id?: string;
            agent_id?: unknown;
            first_clicked_at?: string | null;
            click_count?: number;
          } | null;
          contactId = row?.contact_id;
          agentId = row?.agent_id ?? null;

          // Bookkeeping: increment click_count; stamp first_clicked_at
          // only if this is the first click. Read-modify-write with a
          // brief race window — acceptable for a metric, not financial.
          if (row?.contact_id) {
            const update: Record<string, unknown> = {
              click_count: (row.click_count ?? 0) + 1,
            };
            if (!row.first_clicked_at) {
              update.first_clicked_at = new Date().toISOString();
            }
            await supabaseAdmin
              .from("agent_property_recommendations")
              .update(update as never)
              .eq("id", recommendationId);
          }
        }

        if (contactId) {
          await supabaseAdmin.from("contact_events").insert({
            contact_id: contactId,
            agent_id: agentId as never,
            event_type: "listing_alert_clicked",
            source: "email",
            payload: {
              saved_search_id: savedSearchId,
              recommendation_id: recommendationId,
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
