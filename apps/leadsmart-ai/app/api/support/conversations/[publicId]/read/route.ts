import { NextResponse } from "next/server";
import { isPrismaConfigured, prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ publicId: string }> };

/**
 * Customer has viewed the thread — clear unread count for support-originated content.
 */
export async function PATCH(_req: Request, ctx: RouteParams) {
  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Support database is not configured (DATABASE_URL)." },
      { status: 503 }
    );
  }

  const { publicId } = await ctx.params;

  try {
    const conv = await prisma.supportConversation.findUnique({
      where: { publicId },
      select: { id: true },
    });

    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
    }

    await prisma.supportConversation.update({
      where: { id: conv.id },
      data: { unreadForCustomer: 0, updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("support mark read", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
