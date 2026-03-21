import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await ctx.params;
    const form = await req.formData();
    const active = form.get("active");
    const nextActive = active === "1" || active === "true";

    const { error } = await supabase
      .from("automation_rules")
      .update({ active: nextActive })
      .eq("id", id);
    if (error) throw error;

    // Redirect back to dashboard page for non-AJAX form post.
    return NextResponse.redirect(new URL("/dashboard/automation", req.url), { status: 303 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

