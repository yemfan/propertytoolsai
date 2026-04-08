import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET — list saved flyers for agent. */
export async function GET() {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id, default_flyer_template").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const { data: flyers } = await supabaseAdmin
      .from("saved_flyers")
      .select("id, template_key, property_address, created_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      ok: true,
      flyers: flyers ?? [],
      defaultTemplate: (agent as Record<string, unknown>).default_flyer_template ?? "classic",
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

/** POST — save a flyer + optionally set default template. */
export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      templateKey?: string;
      propertyAddress?: string;
      flyerData?: Record<string, unknown>;
      setAsDefault?: boolean;
    };

    // Save flyer
    if (body.propertyAddress && body.flyerData) {
      await supabaseAdmin.from("saved_flyers").insert({
        agent_id: agent.id,
        template_key: body.templateKey ?? "classic",
        property_address: body.propertyAddress,
        flyer_data: body.flyerData,
      } as Record<string, unknown>);
    }

    // Set default template
    if (body.setAsDefault && body.templateKey) {
      await supabaseAdmin
        .from("agents")
        .update({ default_flyer_template: body.templateKey } as Record<string, unknown>)
        .eq("id", agent.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
