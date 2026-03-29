import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createDailyBriefingForAgent } from "@/lib/dailyBriefing";
import { sendEmail } from "@/lib/email";

export async function GET() {
  try {
    const { data: agents, error } = await supabaseServer
      .from("agents")
      .select("id")
      .limit(500);
    if (error) throw error;

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const agent of (agents as any[]) ?? []) {
      processed++;
      try {
        const agentId = String(agent.id);

        const brief = await createDailyBriefingForAgent(agentId);
        if (brief.skipped) {
          skipped++;
          continue;
        }

        // Best-effort email: some legacy schemas do not have agents.auth_user_id yet.
        let authUserId = "";
        try {
          const { data: agentWithAuth } = await supabaseServer
            .from("agents")
            .select("auth_user_id")
            .eq("id", agent.id)
            .maybeSingle();
          authUserId = String((agentWithAuth as any)?.auth_user_id ?? "");
        } catch {
          authUserId = "";
        }
        if (!authUserId) {
          skipped++;
          continue;
        }

        const { data: authUser, error: authErr } = await supabaseServer.auth.admin.getUserById(
          authUserId
        );
        if (authErr || !authUser?.user?.email) {
          skipped++;
          continue;
        }

        const briefing = brief.briefing as any;
        const insights = briefing?.insights ?? {};
        const actions = Array.isArray(insights?.suggestedActions) ? insights.suggestedActions : [];
        const topOpportunity = String(insights?.topOpportunity ?? "");

        await sendEmail({
          to: authUser.user.email,
          subject: "Your Daily AI Lead Briefing",
          text: `${briefing?.summary ?? "No summary"}\n\nTop opportunity:\n${topOpportunity || "—"}\n\nSuggested actions:\n- ${actions.join("\n- ")}`,
        });

        sent++;
      } catch (e) {
        failed++;
      }
    }

    return NextResponse.json({ ok: true, processed, sent, skipped, failed });
  } catch (e: any) {
    console.error("daily-briefing cron error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

