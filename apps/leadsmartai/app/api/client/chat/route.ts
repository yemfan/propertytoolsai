import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { assertLeadAccessForUser } from "@/lib/clientPortalContext";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

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

  const since = url.searchParams.get("since");
  let q = supabaseServer
    .from("client_portal_messages")
    .select("id,sender_role,body,created_at,sender_auth_user_id")
    .eq("contact_id", leadId as any)
    .order("created_at", { ascending: true })
    .limit(200);

  if (since) {
    q = q.gt("created_at", since);
  }

  const { data, error } = await q;

  if (error) {
    console.error("client chat GET", error);
    return NextResponse.json({ ok: false, message: "Database error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    messages: (data ?? []).map((m: any) => ({
      id: String(m.id),
      role: m.sender_role === "agent" ? "agent" : "client",
      body: String(m.body),
      created_at: String(m.created_at),
      mine: m.sender_role === "client" && String(m.sender_auth_user_id) === user.id,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: { leadId?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const leadId = String(body.leadId ?? "");
  const text = String(body.body ?? "").trim();
  if (!leadId || !text) {
    return NextResponse.json({ ok: false, message: "leadId and body required" }, { status: 400 });
  }

  const lead = await assertLeadAccessForUser(user, leadId);
  if (!lead) {
    return NextResponse.json({ ok: false, message: "Lead not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("client_portal_messages")
    .insert({
      contact_id: leadId as any,
      sender_role: "client",
      sender_auth_user_id: user.id,
      body: text,
    } as any)
    .select("id,sender_role,body,created_at")
    .single();

  if (error) {
    console.error("client chat POST", error);
    return NextResponse.json({ ok: false, message: "Database error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: {
      id: String((data as any).id),
      role: "client",
      body: String((data as any).body),
      created_at: String((data as any).created_at),
      mine: true,
    },
  });
}
