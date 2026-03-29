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

  const { data, error } = await supabaseServer
    .from("client_saved_homes")
    .select("id,lead_id,address,ai_score,insights,created_at,updated_at")
    .eq("auth_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("client saved GET", error);
    return NextResponse.json({ ok: false, message: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: {
    address?: string;
    ai_score?: number;
    insights?: Record<string, unknown>;
    leadId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const address = String(body.address ?? "").trim();
  if (!address) {
    return NextResponse.json({ ok: false, message: "address required" }, { status: 400 });
  }

  let leadIdFk: string | null = null;
  if (body.leadId) {
    const lead = await assertLeadAccessForUser(user, String(body.leadId));
    if (!lead) {
      return NextResponse.json({ ok: false, message: "Invalid leadId" }, { status: 403 });
    }
    leadIdFk = String(lead.id);
  }

  const { data, error } = await supabaseServer
    .from("client_saved_homes")
    .insert({
      auth_user_id: user.id,
      lead_id: leadIdFk as any,
      address,
      ai_score: body.ai_score != null ? Math.round(Number(body.ai_score)) : null,
      insights: body.insights ?? {},
    } as any)
    .select("id,lead_id,address,ai_score,insights,created_at,updated_at")
    .single();

  if (error) {
    console.error("client saved POST", error);
    return NextResponse.json({ ok: false, message: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: data });
}
