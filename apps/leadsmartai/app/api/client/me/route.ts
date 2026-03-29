import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { findLeadsForPortalUser } from "@/lib/clientPortalContext";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const leadId = url.searchParams.get("leadId");
  const leads = await findLeadsForPortalUser(user, leadId);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    leads: leads.map((l) => ({
      id: String(l.id),
      name: l.name,
      property_address: l.property_address,
      lead_status: l.lead_status,
    })),
    primaryLeadId: leads[0] ? String(leads[0].id) : null,
  });
}
