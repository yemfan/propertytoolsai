import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseMatchPreferences } from "@/lib/match/findMatches";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { leadId, preferences } = body as { leadId?: string; preferences?: unknown };

    if (!leadId || !preferences) {
      return NextResponse.json({ success: false, error: "leadId and preferences required" }, { status: 400 });
    }

    const prefs = parseMatchPreferences(preferences);
    if (!prefs) {
      return NextResponse.json({ success: false, error: "Invalid preferences" }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from("lead_saved_searches").insert({
      lead_id: leadId,
      preferences: prefs,
      frequency: "daily",
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/match/save-search", e);
    return NextResponse.json({ success: false, error: "Failed to save search" }, { status: 500 });
  }
}
