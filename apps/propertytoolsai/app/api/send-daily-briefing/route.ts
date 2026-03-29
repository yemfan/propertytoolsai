import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { createDailyBriefingForAgent } from "@/lib/dailyBriefing";
import { sendEmail } from "@/lib/email";

async function getAgentIdForUser(userId: string) {
  try {
    const { data: agent } = await supabaseServer
      .from("agents")
      .select("id,auth_user_id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if ((agent as any)?.id) return String((agent as any).id);
  } catch {
    // legacy schema may not have auth_user_id
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const agentId = await getAgentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json(
        { ok: false, error: "Agent account not found" },
        { status: 404 }
      );
    }

    const result = await createDailyBriefingForAgent(String(agentId));
    const briefing = result.briefing as any;

    const insights = briefing?.insights ?? {};
    const actions = Array.isArray(insights?.suggestedActions) ? insights.suggestedActions : [];
    const topOpportunity = String(insights?.topOpportunity ?? "");

    await sendEmail({
      to: user.email ?? "",
      subject: "Your Daily AI Lead Briefing",
      text: `${briefing?.summary ?? "No summary"}\n\nTop opportunity:\n${topOpportunity || "—"}\n\nSuggested actions:\n- ${actions.join("\n- ")}`,
      html: `<div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color: #0f172a;">
  <h2 style="margin: 0 0 10px;">Today's AI Briefing</h2>
  <p>${String(briefing?.summary ?? "").replaceAll("\n", "<br />")}</p>
  <p><strong>Top opportunity:</strong> ${topOpportunity || "—"}</p>
  <p><strong>Suggested actions:</strong></p>
  <ul>${actions.map((a: string) => `<li>${a}</li>`).join("")}</ul>
</div>`,
    });

    return NextResponse.json({
      ok: true,
      skipped: result.skipped,
      briefing,
    });
  } catch (e: any) {
    console.error("send-daily-briefing error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

