import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase
      .from("agents")
      .select("id, brand_name, signature_html, logo_url")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (!agent) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    return NextResponse.json({
      ok: true,
      branding: {
        brandName: (agent as Record<string, unknown>).brand_name ?? "",
        signatureHtml: (agent as Record<string, unknown>).signature_html ?? "",
        logoUrl: (agent as Record<string, unknown>).logo_url ?? "",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      brandName?: string;
      signatureHtml?: string;
      logoUrl?: string;
    };

    const update: Record<string, unknown> = {};
    if (body.brandName !== undefined) update.brand_name = String(body.brandName).slice(0, 200);
    if (body.signatureHtml !== undefined) update.signature_html = String(body.signatureHtml).slice(0, 2000);
    if (body.logoUrl !== undefined) update.logo_url = String(body.logoUrl).slice(0, 500);

    if (!Object.keys(update).length) {
      return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("agents")
      .update(update)
      .eq("id", agent.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
