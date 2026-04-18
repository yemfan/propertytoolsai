import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { assertLeadAccessForUser } from "@/lib/clientPortalContext";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export type ClientDocumentRow = {
  id: string;
  title: string;
  doc_type: string;
  url: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ ok: false, message: "leadId required" }, { status: 400 });
  }

  const lead = await assertLeadAccessForUser(user, leadId);
  if (!lead) {
    return NextResponse.json({ ok: false, message: "Lead not found" }, { status: 404 });
  }

  const docs: ClientDocumentRow[] = [];

  if (lead.report_id) {
    docs.push({
      id: `report-${lead.report_id}`,
      title: "Home value / CMA report",
      doc_type: "report",
      url: `/report/${encodeURIComponent(String(lead.report_id))}`,
      created_at: lead.created_at ?? new Date().toISOString(),
    });
  }

  const { data, error } = await supabaseServer
    .from("client_portal_documents")
    .select("id,title,doc_type,url,created_at")
    .eq("contact_id", leadId as any)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!error && data?.length) {
    for (const row of data as any[]) {
      docs.push({
        id: String(row.id),
        title: String(row.title),
        doc_type: String(row.doc_type),
        url: row.url ? String(row.url) : null,
        created_at: String(row.created_at),
      });
    }
  }

  return NextResponse.json({ ok: true, documents: docs });
}
