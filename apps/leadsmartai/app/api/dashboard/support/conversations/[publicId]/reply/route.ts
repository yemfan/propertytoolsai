import { NextResponse } from "next/server";
import { MessageSender, SupportMessageType, SupportStatus } from "@prisma/client";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { prismaConversationToUi } from "@/lib/support/mapPrismaSupportToUi";
import { getSupportStaffContext } from "@/lib/support/supportStaffAuth";

type RouteParams = { params: Promise<{ publicId: string }> };

/**
 * Agent/admin reply or internal note (authenticated; cookie session).
 */
export async function POST(req: Request, ctx: RouteParams) {
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

  let body: { body?: string; internalNote?: boolean };
  try {
    body = (await req.json()) as { body?: string; internalNote?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.body ?? "").trim();
  const internal = Boolean(body.internalNote);
  if (!text || text.length > 8000) {
    return NextResponse.json({ ok: false, error: "body is required (max 8000 chars)." }, { status: 400 });
  }

  const displayName =
    staff.email?.split("@")[0]?.trim() || (staff.kind === "admin" ? "Admin" : "Support");

  try {
    const conv = await prisma.supportConversation.findUnique({ where: { publicId } });
    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      if (internal) {
        await tx.supportMessage.create({
          data: {
            conversationId: conv.id,
            senderType: MessageSender.system,
            senderName: "Internal Note",
            body: text,
            messageType: SupportMessageType.text,
            isInternalNote: true,
          },
        });

        return tx.supportConversation.update({
          where: { id: conv.id },
          data: { updatedAt: now },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
      }

      await tx.supportMessage.create({
        data: {
          conversationId: conv.id,
          senderType: MessageSender.support,
          senderName: displayName,
          senderEmail: staff.email,
          body: text,
          messageType: SupportMessageType.text,
          isInternalNote: false,
        },
      });

      return tx.supportConversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: now,
          lastMessageBy: MessageSender.support,
          status: SupportStatus.waiting_on_customer,
          unreadForCustomer: { increment: 1 },
          unreadForSupport: 0,
          updatedAt: now,
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    });

    return NextResponse.json({
      ok: true,
      conversation: prismaConversationToUi(updated),
    });
  } catch (e: unknown) {
    console.error("support staff reply", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
