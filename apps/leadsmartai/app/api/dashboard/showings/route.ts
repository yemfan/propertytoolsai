import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createShowing,
  listShowingsForAgent,
  type CreateShowingInput,
} from "@/lib/showings/service";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/showings
 *   ?contactId=<uuid>  — optional filter by buyer
 */
export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId") || undefined;
    const showings = await listShowingsForAgent(String(agentId), { contactId });
    return NextResponse.json({ ok: true, showings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/dashboard/showings:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/showings
 * Body: { contactId, propertyAddress, scheduledAt, ...optional }
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as Partial<CreateShowingInput>;

    if (!body.contactId || !body.propertyAddress || !body.scheduledAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "contactId, propertyAddress, and scheduledAt are required.",
        },
        { status: 400 },
      );
    }

    const created = await createShowing({
      agentId: String(agentId),
      contactId: String(body.contactId),
      propertyAddress: String(body.propertyAddress),
      scheduledAt: String(body.scheduledAt),
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      mlsNumber: body.mlsNumber ?? null,
      mlsUrl: body.mlsUrl ?? null,
      durationMinutes: body.durationMinutes ?? null,
      accessNotes: body.accessNotes ?? null,
      listingAgentName: body.listingAgentName ?? null,
      listingAgentEmail: body.listingAgentEmail ?? null,
      listingAgentPhone: body.listingAgentPhone ?? null,
      notes: body.notes ?? null,
    });

    return NextResponse.json({ ok: true, showing: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/showings:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
