import { NextResponse } from "next/server";
import { getCurrentBrokerContext } from "@/lib/loan-broker/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { brokerId } = await getCurrentBrokerContext();

    const { data: all } = await supabaseServer
      .from("loan_applications")
      .select("id, pipeline_stage, loan_amount, status, created_at, updated_at")
      .eq("assigned_broker_id", brokerId)
      .limit(2000);

    const apps = (all ?? []) as Array<{
      id: string;
      pipeline_stage: string;
      loan_amount: number | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>;

    const active = apps.filter((a) => a.status !== "cancelled" && a.pipeline_stage !== "funded");
    const funded = apps.filter((a) => a.pipeline_stage === "funded");
    const thisMonth = new Date();
    thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
    const fundedThisMonth = funded.filter((a) => new Date(a.updated_at) >= thisMonth);

    const pipelineValue = active.reduce((sum, a) => sum + (Number(a.loan_amount) || 0), 0);

    // Avg days to close for funded loans
    const closeDays = funded.map((a) => {
      const created = new Date(a.created_at).getTime();
      const updated = new Date(a.updated_at).getTime();
      return Math.round((updated - created) / 86_400_000);
    }).filter((d) => d > 0);
    const avgDaysToClose = closeDays.length > 0
      ? Math.round(closeDays.reduce((a, b) => a + b, 0) / closeDays.length)
      : null;

    // Stage distribution
    const stages = ["inquiry", "pre_qualification", "application", "processing", "underwriting", "closing", "funded"];
    const stageLabels: Record<string, string> = {
      inquiry: "Inquiry",
      pre_qualification: "Pre-Qual",
      application: "Application",
      processing: "Processing",
      underwriting: "Underwriting",
      closing: "Closing",
      funded: "Funded",
    };
    const stageColors: Record<string, string> = {
      inquiry: "#94a3b8",
      pre_qualification: "#3b82f6",
      application: "#8b5cf6",
      processing: "#f59e0b",
      underwriting: "#f97316",
      closing: "#10b981",
      funded: "#059669",
    };

    const stageCounts = stages.map((s) => ({
      name: stageLabels[s] || s,
      value: apps.filter((a) => a.pipeline_stage === s).length,
      color: stageColors[s] || "#64748b",
    }));

    // Funded by month (last 12)
    const monthCounts: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthCounts[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    for (const a of funded) {
      const d = new Date(a.updated_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthCounts) monthCounts[key]++;
    }
    const fundedByMonth = Object.entries(monthCounts).map(([month, count]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      count,
    }));

    return NextResponse.json({
      ok: true,
      kpis: {
        activeApplications: active.length,
        fundedThisMonth: fundedThisMonth.length,
        avgDaysToClose,
        pipelineValue,
        totalFunded: funded.length,
        conversionRate: apps.length > 0 ? Math.round((funded.length / apps.length) * 100) : 0,
      },
      stageCounts,
      fundedByMonth,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
