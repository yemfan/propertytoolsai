import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createBuyerLeadFromAffordability } from "@/lib/affordability/lead";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, name, email, phone } = body;

    if (!sessionId || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: session, error } = await supabaseAdmin
      .from("affordability_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const lead = await createBuyerLeadFromAffordability({
      name,
      email,
      phone,
      zip: session?.input_json?.zip,
      maxHomePrice: session.max_home_price,
      sessionId,
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      report: session.result_json,
    });
  } catch (error) {
    console.error("affordability unlock error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to unlock affordability report" },
      { status: 500 }
    );
  }
}
