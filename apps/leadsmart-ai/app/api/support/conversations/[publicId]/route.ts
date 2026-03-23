import { NextResponse } from "next/server";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { supportMessageToPublicJson } from "@/lib/supportMessagePublic";

type RouteParams = { params: Promise<{ publicId: string }> };

const publicMessagesInclude = {
  where: { isInternalNote: false },
  orderBy: { createdAt: "asc" as const },
};

export async function GET(_req: Request, ctx: RouteParams) {
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
      include: {
        messages: publicMessagesInclude,
      },
    });

    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      conversation: {
        publicId: conv.publicId,
        status: conv.status,
        name: conv.customerName,
        email: conv.customerEmail,
        subject: conv.subject,
        unreadForCustomer: conv.unreadForCustomer,
        unreadForSupport: conv.unreadForSupport,
        updatedAt: conv.updatedAt.toISOString(),
      },
      messages: conv.messages.map(supportMessageToPublicJson),
    });
  } catch (e: unknown) {
    console.error("support conversation get", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
