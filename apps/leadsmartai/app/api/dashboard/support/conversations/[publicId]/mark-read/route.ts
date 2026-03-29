import { NextResponse } from "next/server";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { prismaConversationToUi } from "@/lib/support/mapPrismaSupportToUi";
import { getSupportStaffContext } from "@/lib/support/supportStaffAuth";

type RouteParams = { params: Promise<{ publicId: string }> };

/** Clears `unreadForSupport` after staff opens the thread. */
export async function POST(_req: Request, ctx: RouteParams) {
  const staff = await getSupportStaffContext();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Support database is not configured (DATABASE_URL)." },
      { status: 503 }
    );
  }

  const { publicId } = await ctx.params;

  try {
    const updated = await prisma.supportConversation.update({
      where: { publicId },
      data: { unreadForSupport: 0, updatedAt: new Date() },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({
      ok: true,
      conversation: prismaConversationToUi(updated),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }
}
