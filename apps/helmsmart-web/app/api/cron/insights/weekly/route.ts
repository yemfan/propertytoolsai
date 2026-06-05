/**
 * Weekly business insights cron — GET /api/cron/insights/weekly
 *
 * Runs Monday mornings. Generates Tim's weekly digest for every org that has
 * had activity, and bumps Tim's insights_delivered metric.
 *
 * Auth: Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClientFor, packServiceConns } from "@/lib/supabase/server";
import { generateBusinessInsight } from "@/lib/business-insights";
import { createNotificationService } from "@/lib/actions/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  let generated = 0;
  const errors: string[] = [];

  for (const conn of packServiceConns()) {
    const db = createServiceClientFor(conn);

    // Orgs that have at least one client (i.e. real activity)
    const { data: orgs } = await db
      .from("organizations")
      .select("id")
      .limit(500);

    for (const org of orgs ?? []) {
      // Skip orgs with no clients to avoid burning tokens on empty accounts
      const { count } = await db
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id);
      if (!count) continue;

      const result = await generateBusinessInsight(db, org.id, now);
      if (!result.ok) {
        errors.push(`${org.id}: ${result.error}`);
        continue;
      }
      generated++;

      // Bump Tim's insights_delivered metric (best-effort)
      try {
        const { data: tim } = await db
          .from("ai_employees")
          .select("id")
          .eq("organization_id", org.id)
          .eq("slug", "tim")
          .maybeSingle();
        if (tim) {
          const metricDate = now.toISOString().slice(0, 10);
          const { data: existing } = await db
            .from("ai_employee_metrics")
            .select("metric_value")
            .eq("organization_id", org.id)
            .eq("employee_id", tim.id)
            .eq("metric_date", metricDate)
            .eq("metric_key", "insights_delivered")
            .maybeSingle();
          await db.from("ai_employee_metrics").upsert(
            {
              organization_id: org.id,
              employee_id: tim.id,
              metric_date: metricDate,
              metric_key: "insights_delivered",
              metric_value: (Number(existing?.metric_value) || 0) + 1,
            },
            { onConflict: "organization_id,employee_id,metric_date,metric_key" }
          );
        }
      } catch {
        // metrics table may be absent for this pack — ignore
      }

      // Notify the owner
      await createNotificationService(
        org.id,
        {
          type: "system",
          title: "Tim's weekly business insights are ready",
          body: result.insight?.headline ?? "Your weekly digest is ready to review.",
          link: "/insights",
        },
        db
      );
    }
  }

  return NextResponse.json({ ok: true, generated, errors });
}
