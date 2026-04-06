import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { approvePlan, startPlan, updatePlanStatus, updateStep } from "@/lib/marketing/planGenerator";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const [planRes, stepsRes] = await Promise.all([
      supabaseAdmin.from("marketing_plans").select("*").eq("id", id).eq("agent_id", agent.id).maybeSingle(),
      supabaseAdmin.from("marketing_plan_steps").select("*").eq("plan_id", id).order("step_order", { ascending: true }),
    ]);

    if (!planRes.data) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });

    return NextResponse.json({ ok: true, plan: { ...planRes.data, steps: stepsRes.data ?? [] } });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      action?: "approve" | "start" | "pause" | "cancel";
      stepId?: string;
      stepPatch?: { enabled?: boolean; body?: string; subject?: string; delay_days?: number };
    };

    // Step update
    if (body.stepId && body.stepPatch) {
      await updateStep(body.stepId, body.stepPatch);
      return NextResponse.json({ ok: true });
    }

    // Plan status actions
    switch (body.action) {
      case "approve":
        await approvePlan(id);
        break;
      case "start":
        await startPlan(id);
        break;
      case "pause":
        await updatePlanStatus(id, "paused");
        break;
      case "cancel":
        await updatePlanStatus(id, "cancelled");
        break;
      default:
        return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
