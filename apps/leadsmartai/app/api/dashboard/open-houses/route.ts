import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createOpenHouse,
  listOpenHousesForAgent,
  type CreateOpenHouseInput,
} from "@/lib/open-houses/service";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/open-houses
 *   List all open houses for the agent (future + past) with per-event
 *   visitor roll-ups.
 *
 * POST /api/dashboard/open-houses
 *   Create a scheduled open house. Returns the row including signin_slug
 *   so the client can build the public URL + QR code.
 *
 * The legacy analytics endpoint (contact-source rollups) moved to
 * /api/dashboard/open-houses/stats. The UI still calls both.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const openHouses = await listOpenHousesForAgent(String(agentId));
    return NextResponse.json({ ok: true, openHouses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/dashboard/open-houses:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as Partial<CreateOpenHouseInput>;

    if (!body.propertyAddress || !body.startAt || !body.endAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "propertyAddress, startAt, and endAt are required.",
        },
        { status: 400 },
      );
    }
    if (new Date(body.endAt).getTime() <= new Date(body.startAt).getTime()) {
      return NextResponse.json(
        { ok: false, error: "endAt must be after startAt." },
        { status: 400 },
      );
    }

    const created = await createOpenHouse({
      agentId: String(agentId),
      propertyAddress: String(body.propertyAddress),
      startAt: String(body.startAt),
      endAt: String(body.endAt),
      transactionId: body.transactionId ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      mlsNumber: body.mlsNumber ?? null,
      mlsUrl: body.mlsUrl ?? null,
      listPrice: body.listPrice ?? null,
      hostNotes: body.hostNotes ?? null,
    });
    return NextResponse.json({ ok: true, openHouse: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/open-houses:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
