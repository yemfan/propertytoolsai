import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/authFromRequest";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const location = (url.searchParams.get("location") ?? "").trim();
    const leadType = (url.searchParams.get("leadType") ?? "").trim().toLowerCase();
    const minPriceRaw = url.searchParams.get("minPrice");
    const maxPriceRaw = url.searchParams.get("maxPrice");
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");

    const minPrice = minPriceRaw != null && Number.isFinite(Number(minPriceRaw)) ? Number(minPriceRaw) : null;
    const maxPrice = maxPriceRaw != null && Number.isFinite(Number(maxPriceRaw)) ? Number(maxPriceRaw) : null;

    const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 50;
    const pageIndex = Number.isFinite(page) && page > 0 ? page : 1;
    const from = (pageIndex - 1) * size;
    const to = from + size - 1;

    let q = supabaseServer
      .from("opportunities")
      .select(
        "id,property_address,lead_type,intent_score,usage_count,estimated_value,status,assigned_agent_id,price,created_at",
        { count: "exact" }
      )
      .eq("status", "available");

    if (location) {
      q = q.ilike("property_address", `%${location}%`);
    }
    if (leadType && ["seller", "buyer", "refinance"].includes(leadType)) {
      q = q.eq("lead_type", leadType);
    }
    if (minPrice != null) q = q.gte("price", minPrice);
    if (maxPrice != null) q = q.lte("price", maxPrice);

    q = q.order("created_at", { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      opportunities: data ?? [],
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

