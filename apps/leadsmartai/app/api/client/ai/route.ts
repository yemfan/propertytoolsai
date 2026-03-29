import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { assertLeadAccessForUser } from "@/lib/clientPortalContext";
import { answerClientAssistantQuestion } from "@/lib/clientPortalAi";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: { leadId?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const q = String(body.question ?? "").trim();
  if (!q) {
    return NextResponse.json({ ok: false, message: "question required" }, { status: 400 });
  }

  let lead = null as Awaited<ReturnType<typeof assertLeadAccessForUser>>;
  if (body.leadId) {
    lead = await assertLeadAccessForUser(user, String(body.leadId));
  } else {
    const { findLeadsForPortalUser } = await import("@/lib/clientPortalContext");
    const leads = await findLeadsForPortalUser(user);
    lead = leads[0] ?? null;
  }

  const answer = await answerClientAssistantQuestion({ question: q, lead });

  return NextResponse.json({ ok: true, answer });
}
