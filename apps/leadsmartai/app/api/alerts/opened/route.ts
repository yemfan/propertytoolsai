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

  if (savedSearchId) {
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
            event_type: "listing_alert_opened",
            source: "email",
            payload: { saved_search_id: savedSearchId } as never,
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
