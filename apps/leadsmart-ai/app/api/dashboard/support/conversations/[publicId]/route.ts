import { NextResponse } from "next/server";
import { SupportPriority, SupportStatus } from "@prisma/client";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { prismaConversationToUi } from "@/lib/support/mapPrismaSupportToUi";
import { getSupportStaffContext } from "@/lib/support/supportStaffAuth";

type RouteParams = { params: Promise<{ publicId: string }> };

const ALLOWED_STATUS = new Set<string>(Object.values(SupportStatus));
const ALLOWED_PRIORITY = new Set<string>(Object.values(SupportPriority));

/**
 * Full thread for staff (includes internal notes).
 */
export async function GET(_req: Request, ctx: RouteParams) {
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
    const row = await prisma.supportConversation.findUnique({
      where: { publicId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!row) {
      return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      conversation: prismaConversationToUi(row),
    });
  } catch (e: unknown) {
    console.error("support conversation get", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: RouteParams) {
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

  let body: {
    status?: string;
    priority?: string;
    assignedAgentName?: string | null;
    assignedAgentId?: string | null;
    assignToMe?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  let anyField = false;

  if (body.assignToMe === true) {
    const label = staff.email?.split("@")[0]?.trim() || (staff.kind === "admin" ? "Admin" : "Agent");
    data.assignedAgentId = staff.userId;
    data.assignedAgentName = label;
    anyField = true;
  }

  if (body.status !== undefined) {
    const s = String(body.status).trim();
    if (!ALLOWED_STATUS.has(s)) {
      return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
    }
    data.status = s as SupportStatus;
    anyField = true;
  }

  if (body.priority !== undefined) {
    const p = String(body.priority).trim();
    if (!ALLOWED_PRIORITY.has(p)) {
      return NextResponse.json({ ok: false, error: "Invalid priority." }, { status: 400 });
    }
    data.priority = p as SupportPriority;
    anyField = true;
  }

  if (body.assignedAgentName !== undefined) {
    data.assignedAgentName = body.assignedAgentName === null ? null : String(body.assignedAgentName).trim() || null;
    anyField = true;
  }
  if (body.assignedAgentId !== undefined) {
    data.assignedAgentId = body.assignedAgentId === null ? null : String(body.assignedAgentId).trim() || null;
    anyField = true;
  }

  if (!anyField) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.supportConversation.update({
      where: { publicId },
      data,
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
