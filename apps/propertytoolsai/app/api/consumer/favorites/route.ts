import { NextResponse } from "next/server";
import { getCurrentConsumerContact } from "@/lib/contacts/consumerContact";
import {
  addConsumerFavorite,
  listConsumerFavorites,
} from "@/lib/contacts/favorites";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getCurrentConsumerContact(req);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  try {
    const favorites = await listConsumerFavorites(ctx.contactId);
    return NextResponse.json({ ok: true, favorites });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await getCurrentConsumerContact(req);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "Sign in to save favorites" },
      { status: 401 },
    );
  }
  try {
    const body = (await req.json()) as {
      propertyId?: unknown;
      address?: unknown;
      city?: unknown;
      state?: unknown;
      zip?: unknown;
      price?: unknown;
      beds?: unknown;
      baths?: unknown;
      sqft?: unknown;
      propertyType?: unknown;
      photoUrl?: unknown;
      notes?: unknown;
    };
    if (typeof body.propertyId !== "string" || !body.propertyId.trim()) {
      return NextResponse.json(
        { ok: false, error: "propertyId required" },
        { status: 400 },
      );
    }
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : undefined;

    const favorite = await addConsumerFavorite(ctx.contactId, {
      propertyId: body.propertyId,
      address: str(body.address),
      city: str(body.city),
      state: str(body.state),
      zip: str(body.zip),
      price: num(body.price),
      beds: num(body.beds),
      baths: num(body.baths),
      sqft: num(body.sqft),
      propertyType: str(body.propertyType),
      photoUrl: str(body.photoUrl),
      notes: str(body.notes),
    });
    return NextResponse.json({ ok: true, favorite });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
