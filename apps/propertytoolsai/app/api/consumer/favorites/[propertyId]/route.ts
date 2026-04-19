import { NextResponse } from "next/server";
import { getCurrentConsumerContact } from "@/lib/contacts/consumerContact";
import { removeConsumerFavorite } from "@/lib/contacts/favorites";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ propertyId: string }> },
) {
  const auth = await getCurrentConsumerContact(req);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  try {
    const { propertyId } = await ctx.params;
    await removeConsumerFavorite(auth.contactId, decodeURIComponent(propertyId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
