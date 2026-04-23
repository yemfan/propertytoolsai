import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  deleteListingOffer,
  getListingOfferWithCounters,
  updateListingOffer,
  type UpdateListingOfferInput,
} from "@/lib/listing-offers/service";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const result = await getListingOfferWithCounters(String(agentId), id);
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET listing-offers/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpdateListingOfferInput & {
      rejectSiblingsOnAccept?: boolean;
    };
    const { rejectSiblingsOnAccept, ...patch } = body;
    const { offer, siblingsRejected } = await updateListingOffer(
      String(agentId),
      id,
      patch,
      { rejectSiblingsOnAccept: Boolean(rejectSiblingsOnAccept) },
    );
    if (!offer) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, offer, siblingsRejected });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("PATCH listing-offers/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const ok = await deleteListingOffer(String(agentId), id);
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE listing-offers/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
