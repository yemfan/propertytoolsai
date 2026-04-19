import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createAndSendRecommendation,
  listRecommendationsForContact,
} from "@/lib/contacts/recommendations/service";
import type { RecommendationListing } from "@/lib/contacts/recommendations/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const recommendations = await listRecommendationsForContact(agentId, id);
    return NextResponse.json({ ok: true, recommendations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id: contactId } = await ctx.params;
    const body = (await req.json()) as {
      subject?: unknown;
      note?: unknown;
      listings?: unknown;
      suppressSignature?: unknown;
    };

    if (!Array.isArray(body.listings) || body.listings.length === 0) {
      return NextResponse.json(
        { ok: false, error: "At least one listing required" },
        { status: 400 },
      );
    }

    const listings: RecommendationListing[] = (body.listings as unknown[])
      .filter((l): l is Record<string, unknown> => l != null && typeof l === "object")
      .map((l) => {
        const str = (v: unknown) => (typeof v === "string" ? v : undefined);
        const num = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? v : undefined;
        return {
          propertyId: String(l.propertyId ?? l.property_id ?? ""),
          address: str(l.address),
          city: str(l.city),
          state: str(l.state),
          zip: str(l.zip),
          price: num(l.price),
          beds: num(l.beds),
          baths: num(l.baths),
          sqft: num(l.sqft),
          propertyType: str(l.propertyType ?? l.property_type),
          photoUrl: str(l.photoUrl ?? l.photo_url),
        };
      })
      .filter((l) => l.propertyId);

    if (listings.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Listings must include propertyId" },
        { status: 400 },
      );
    }

    const rec = await createAndSendRecommendation(agentId, {
      contactId,
      subject: typeof body.subject === "string" ? body.subject : "",
      note: typeof body.note === "string" ? body.note : "",
      listings,
      suppressSignature: body.suppressSignature === true,
    });
    return NextResponse.json({ ok: true, recommendation: rec });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|no email|opted out/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
