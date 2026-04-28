import { NextResponse } from "next/server";
import {
  loadByShareToken,
  recordShareView,
} from "@/lib/listing-presentations/service";

/**
 * Public seller-facing read endpoint.
 *
 * GET /api/listing-presentations/view/[token]
 *
 * Returns a redacted view of the presentation — only fields the
 * seller should see. No agent-internal metadata (contact_id,
 * agent_id, view_count, etc.) leaks. The route also bumps the
 * `viewed_at` / `view_count` so the agent can see "Bob viewed
 * your presentation 3 times" on their dashboard.
 *
 * Token-only auth — anyone with the link can view. Rotation via
 * `shareWithToken` invalidates the old link.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const presentation = await loadByShareToken(token);
  if (!presentation) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (presentation.status === "archived" || presentation.status === "closed") {
    return NextResponse.json({ ok: false, error: "Not available" }, { status: 410 });
  }

  // Fire-and-forget. Don't await — even if it fails (network
  // blip), the seller should still see the page.
  void recordShareView({ rawToken: token });

  // Redact: only return fields the seller should see.
  return NextResponse.json({
    ok: true,
    presentation: {
      propertyAddress: presentation.propertyAddress,
      propertyCity: presentation.propertyCity,
      propertyState: presentation.propertyState,
      propertyZip: presentation.propertyZip,
      suggestedListPrice: presentation.suggestedListPrice,
      suggestedListLow: presentation.suggestedListLow,
      suggestedListHigh: presentation.suggestedListHigh,
      sections: presentation.sections.filter((s) => s.enabled),
      renderedPdfUrl: presentation.renderedPdfUrl,
      // status only as a coarse "still active" flag
      status: presentation.status,
    },
  });
}
