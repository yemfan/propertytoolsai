import { NextResponse } from "next/server";
import { MessageSender, SupportStatus } from "@prisma/client";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { supportMessageToPublicJson } from "@/lib/supportMessagePublic";

type RouteParams = { params: Promise<{ publicId: string }> };

/**
 * Customer sends a chat message. Increments `unreadForSupport` until support handles it in admin.
 */
export async function POST(req: Request, ctx: RouteParams) {
  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Support database is not configured (DATABASE_URL)." },
      { status: 503 }
    );
  }

  const { publicId } = await ctx.params;

  let body: { body?: string };
  try {
    body = (await req.json()) as { body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.body ?? "").trim();
  if (!text || text.length > 8000) {
    return NextResponse.json({ ok: false, error: "Message body is required (max 8000 chars)." }, { status: 400 });
  }

  try {
    const conv = await prisma.supportConversation.findUnique({
      where: { publicId },
    });

    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
    }

    if (conv.status === SupportStatus.closed || conv.status === SupportStatus.resolved) {
      return NextResponse.json(
        { ok: false, error: "This conversation is closed. Start a new chat." },
        { status: 409 }
      );
    }

    const now = new Date();
    const msg = await prisma.$transaction(async (tx) => {
      const m = await tx.supportMessage.create({
        data: {
          conversationId: conv.id,
          senderType: MessageSender.customer,
          senderName: conv.customerName,
          senderEmail: conv.customerEmail,
          body: text,
        },
      });

      await tx.supportConversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: now,
          lastMessageBy: MessageSender.customer,
          status: SupportStatus.waiting_on_support,
          unreadForSupport: { increment: 1 },
          updatedAt: now,
        },
      });

      return m;
    });

    return NextResponse.json({
      ok: true,
      message: supportMessageToPublicJson(msg),
    });
  } catch (e: unknown) {
    console.error("support message create", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
