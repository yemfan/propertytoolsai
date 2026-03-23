import { NextResponse } from "next/server";
import { SupportStatus } from "@prisma/client";
import { isPrismaConfigured, prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ publicId: string }> };

const ALLOWED = new Set<string>(Object.values(SupportStatus));

/**
 * User (or client) can set status e.g. resolved when done chatting.
 */
export async function PATCH(req: Request, ctx: RouteParams) {
  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Support database is not configured (DATABASE_URL)." },
      { status: 503 }
    );
  }

  const { publicId } = await ctx.params;

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const raw = String(body.status ?? "").trim();
  const status = raw as SupportStatus;
  if (!ALLOWED.has(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }

  try {
    const updated = await prisma.supportConversation.update({
      where: { publicId },
      data: { status, updatedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      conversation: {
        publicId: updated.publicId,
        status: updated.status,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }
}
