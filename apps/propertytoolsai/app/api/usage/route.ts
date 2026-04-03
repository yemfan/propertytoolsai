import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: true, plan: "guest", usage: null });
    }

    const { data, error } = await supabaseServer
      .from("leadsmart_users")
      .select("plan,subscription_status,estimator_usage_count,cma_usage_count,usage_reset_date")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && (error as { code?: string }).code !== "PGRST116") throw error;

    return NextResponse.json({
      ok: true,
      plan: (data as { plan?: string })?.plan ?? "free",
      subscription_status: (data as { subscription_status?: string | null })?.subscription_status ?? null,
      usage: data
        ? {
            estimator_usage_count: (data as { estimator_usage_count?: number }).estimator_usage_count ?? 0,
            cma_usage_count: (data as { cma_usage_count?: number }).cma_usage_count ?? 0,
            usage_reset_date: (data as { usage_reset_date?: string | null }).usage_reset_date ?? null,
            limits: { estimator: 3, cma: 1 },
          }
        : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
