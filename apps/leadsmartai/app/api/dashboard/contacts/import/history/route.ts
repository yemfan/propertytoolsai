import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const { data, error } = await supabaseAdmin
      .from("contact_import_jobs")
      .select("id, intake_channel, status, file_name, summary, created_at, updated_at, duplicate_strategy")
      .eq("agent_id", auth.agentId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ ok: true, jobs: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load history";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
