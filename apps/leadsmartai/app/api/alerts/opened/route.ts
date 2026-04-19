import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Open-tracking pixel for listing alert emails. The digest email
 * contains a 1×1 transparent GIF at this URL. Gmail / Apple Mail /
 * Outlook fetch the image when the email is opened (modulo image-
 * blocking settings), triggering this handler.
 *
 * Logs a listing_alert_opened event and returns the pixel bytes. Event
 * write is fire-and-forget; we always return the pixel even if the log
 * fails, to avoid breaking the email render.
 */

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const savedSearchId = url.searchParams.get("s");
  const recommendationId = url.searchParams.get("r");

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
            .select("contact_id,agent_id,opened_at")
            .eq("id", recommendationId)
            .maybeSingle();
          const row = data as {
            contact_id?: string;
            agent_id?: unknown;
            opened_at?: string | null;
          } | null;
          contactId = row?.contact_id;
          agentId = row?.agent_id ?? null;

          // Stamp opened_at on first open.
          if (row?.contact_id && !row.opened_at) {
            await supabaseAdmin
              .from("agent_property_recommendations")
              .update({ opened_at: new Date().toISOString() } as never)
              .eq("id", recommendationId);
          }
        }

        if (contactId) {
          await supabaseAdmin.from("contact_events").insert({
            contact_id: contactId,
            agent_id: agentId as never,
            event_type: "listing_alert_opened",
            source: "email",
            payload: {
              saved_search_id: savedSearchId,
              recommendation_id: recommendationId,
            } as never,
          } as never);
        }
      } catch (e) {
        console.error("[alerts/opened] event log failed", e);
      }
    })();
  }

  return new NextResponse(PIXEL as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Length": String(PIXEL.length),
    },
  });
}
