import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import type { LeadStatus } from "@/lib/dashboardService";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? "";
    const rating = url.searchParams.get("rating") ?? "";
    const minScore = url.searchParams.get("minScore");
    const lastActivity = url.searchParams.get("lastActivity");
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");

    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = userData.user;

    const { data: agentRow } = await supabase
      .from("agents")
      .select("id,auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const agentId = (agentRow as any)?.id;
    if (agentId == null) {
      return NextResponse.json(
        { error: "Complete agent signup before using the CRM.", code: "NO_AGENT_ROW" },
        { status: 403 }
      );
    }

    let q = supabase
      .from("leads")
      .select(
        "id,agent_id,name,email,phone,property_address,source,lead_status,notes,engagement_score,last_activity_at,rating,contact_frequency,contact_method,last_contacted_at,next_contact_at,search_location,search_radius,price_min,price_max,beds,baths,created_at",
        { count: "exact" }
      )
      .eq("agent_id", agentId);

    // High-level filter presets
    if (filter === "hot") {
      q = q.eq("rating", "hot");
    } else if (filter === "high_engagement") {
      q = q.gte("engagement_score", 70);
    } else if (filter === "inactive") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      q = q.lte("last_activity_at", sevenDaysAgo);
    }

    // Fine-grained filters
    if (rating) {
      q = q.eq("rating", rating);
    }
    if (minScore) {
      const num = Number(minScore);
      if (Number.isFinite(num)) {
        q = q.gte("engagement_score", num);
      }
    }
    if (lastActivity === "recent") {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("last_activity_at", cutoff);
    } else if (lastActivity === "week") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("last_activity_at", cutoff);
    }

    // Pagination
    const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 50;
    const pageIndex = Number.isFinite(page) && page > 0 ? page : 1;
    const from = (pageIndex - 1) * size;
    const to = from + size - 1;

    q = q.order("created_at", { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    const leads = (data ?? []) as any[];
    const leadIds = leads.map((l) => l.id).filter(Boolean);
    let scoreMap: Record<string, any> = {};
    if (leadIds.length) {
      const { data: scoreRows } = await supabase
        .from("lead_scores")
        .select("lead_id,score,intent,timeline,confidence,explanation,updated_at")
        .in("lead_id", leadIds as any)
        .order("updated_at", { ascending: false })
        .limit(5000);
      for (const row of scoreRows ?? []) {
        const key = String((row as any).lead_id ?? "");
        if (!key || scoreMap[key]) continue;
        scoreMap[key] = row;
      }
    }

    const hydrated = leads.map((l) => {
      const s = scoreMap[String((l as any).id)] as any;
      return {
        ...l,
        ai_lead_score: s ? Number(s.score ?? 0) : null,
        ai_intent: s?.intent ?? null,
        ai_timeline: s?.timeline ?? null,
        ai_confidence: s ? Number(s.confidence ?? 0) : null,
        ai_explanation: Array.isArray(s?.explanation) ? s.explanation : [],
      };
    });

    return NextResponse.json({
      ok: true,
      leads: hydrated,
      total: count ?? 0,
      page: pageIndex,
      pageSize: size,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

