import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { isPremiumPlan, isPremiumSubscriptionStatus } from "@/lib/access";
import { calculatePropertyScore, type PropertyInput } from "@/lib/propertyScoring";
import { runPropertyComparisonAi } from "@/lib/propertyComparisonAi";

export const runtime = "nodejs";

function isPremiumTier(plan: string | null, subscriptionStatus: string | null): boolean {
  return isPremiumSubscriptionStatus(subscriptionStatus) || isPremiumPlan(plan);
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Sign in required for AI comparison." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabaseServer
      .from("user_profiles")
      .select("plan,subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    const plan = (profile as any)?.plan ?? "free";
    const subscriptionStatus = (profile as any)?.subscription_status ?? null;
    const premium = isPremiumTier(plan, subscriptionStatus);

    const body = (await req.json().catch(() => ({}))) as {
      properties?: unknown;
    };

    const raw = body.properties;
    if (!Array.isArray(raw) || raw.length < 2) {
      return NextResponse.json(
        { ok: false, error: "At least two properties are required for comparison." },
        { status: 400 }
      );
    }

    if (!premium) {
      return NextResponse.json(
        {
          ok: false,
          error: "premium_required",
          message: "AI Property Comparison is a Premium feature. Upgrade to compare multiple properties.",
        },
        { status: 402 }
      );
    }

    const properties: PropertyInput[] = [];
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i] as Record<string, unknown>;
      const id = String(row.id ?? `p-${i}`);
      const address = String(row.address ?? "").trim();
      const price = Number(row.price);
      const beds = Number(row.beds);
      const baths = Number(row.baths);
      const sqft = Number(row.sqft);
      const rentRaw = row.rentMonthly;
      const rentMonthly =
        rentRaw == null || rentRaw === ""
          ? null
          : Number.isFinite(Number(rentRaw))
            ? Number(rentRaw)
            : null;

      if (!address || !Number.isFinite(price) || price <= 0) {
        return NextResponse.json(
          { ok: false, error: `Invalid property at index ${i}: address and positive price required.` },
          { status: 400 }
        );
      }
      if (!Number.isFinite(sqft) || sqft <= 0) {
        return NextResponse.json(
          { ok: false, error: `Invalid sqft at index ${i}.` },
          { status: 400 }
        );
      }

      properties.push({
        id,
        address,
        price,
        beds: Number.isFinite(beds) ? beds : 0,
        baths: Number.isFinite(baths) ? baths : 0,
        sqft,
        rentMonthly,
      });
    }

    if (properties.length > 12) {
      return NextResponse.json(
        { ok: false, error: "Maximum 12 properties per request." },
        { status: 400 }
      );
    }

    const scored = properties.map((p) => ({
      property: p,
      score: calculatePropertyScore(p),
    }));

    const ai = await runPropertyComparisonAi(scored);

    return NextResponse.json({
      ok: true,
      premium: true,
      scored,
      ai,
    });
  } catch (e: any) {
    console.error("POST /api/ai/property-comparison", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
