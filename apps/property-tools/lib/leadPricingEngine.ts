import { supabaseServer } from "@/lib/supabaseServer";

type Weights = {
  model_version: string;
  behavior_weight: number;
  engagement_weight: number;
  profile_weight: number;
  market_weight: number;
  base_price: number;
};

type EngineInput = {
  opportunityId?: string;
  leadId?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseCityStateFromAddress(address: string) {
  const parts = String(address ?? "").split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const city = parts[1];
    const statePart = parts[2].split(/\s+/)[0] || "";
    return { city, state: statePart.toUpperCase() };
  }
  return { city: "", state: "" };
}

async function getLatestWeights(): Promise<Weights> {
  const { data } = await supabaseServer
    .from("lead_pricing_weights")
    .select("model_version,behavior_weight,engagement_weight,profile_weight,market_weight,base_price")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    model_version: String((data as any)?.model_version ?? "v1"),
    behavior_weight: Number((data as any)?.behavior_weight ?? 0.25),
    engagement_weight: Number((data as any)?.engagement_weight ?? 0.25),
    profile_weight: Number((data as any)?.profile_weight ?? 0.25),
    market_weight: Number((data as any)?.market_weight ?? 0.25),
    base_price: Number((data as any)?.base_price ?? 10),
  };
}

async function fetchCore(input: EngineInput) {
  let opportunity: any = null;
  let lead: any = null;

  if (input.opportunityId) {
    const { data } = await supabaseServer
      .from("opportunities")
      .select("id,property_address,intent_score,usage_count,estimated_value,lead_type,status,price")
      .eq("id", input.opportunityId)
      .maybeSingle();
    opportunity = data ?? null;
  }

  if (input.leadId) {
    const { data } = await supabaseServer
      .from("leads")
      .select("id,property_address,rating,nurture_score,lead_type,marketplace_opportunity_id")
      .eq("id", Number(input.leadId))
      .maybeSingle();
    lead = data ?? null;
  }

  if (!lead && opportunity?.id) {
    const { data } = await supabaseServer
      .from("leads")
      .select("id,property_address,rating,nurture_score,lead_type,marketplace_opportunity_id")
      .eq("marketplace_opportunity_id", opportunity.id)
      .limit(1)
      .maybeSingle();
    lead = data ?? null;
  }

  const address = String(opportunity?.property_address ?? lead?.property_address ?? "").trim();
  const estimatedValue = Number(opportunity?.estimated_value ?? 0);
  const usageCount = Number(opportunity?.usage_count ?? 0);
  const intentScore = Number(opportunity?.intent_score ?? 0);

  return { opportunity, lead, address, estimatedValue, usageCount, intentScore };
}

async function behaviorSignal(address: string, usageCount: number) {
  if (!address) return 0;
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseServer
    .from("tool_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("property_address", address)
    .gte("created_at", since);
  const totalUsage = Number(count ?? usageCount ?? 0);
  return clamp(totalUsage * 12, 0, 100);
}

async function engagementSignal(lead: any, address: string) {
  let score = Number(lead?.nurture_score ?? 0);
  if (!score && address) {
    const { data } = await supabaseServer
      .from("leads")
      .select("nurture_score")
      .eq("property_address", address)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    score = Number((data as any)?.nurture_score ?? 0);
  }
  const rating = String(lead?.rating ?? "").toLowerCase();
  const ratingBoost = rating === "hot" ? 25 : rating === "warm" ? 12 : 0;
  return clamp(score + ratingBoost, 0, 100);
}

function profileSignal(estimatedValue: number, address: string) {
  const base = clamp((estimatedValue / 1_500_000) * 100, 10, 100);
  const { city } = parseCityStateFromAddress(address);
  const locationBoost = city ? 8 : 0;
  return clamp(base + locationBoost, 0, 100);
}

async function marketSignal(address: string) {
  const { city, state } = parseCityStateFromAddress(address);
  if (!city || !state) return { score: 50, demandMultiplier: 1 };

  const { data } = await supabaseServer
    .from("city_market_data")
    .select("trend,days_on_market,inventory")
    .eq("city", city)
    .eq("state", state)
    .maybeSingle();

  if (!data) return { score: 50, demandMultiplier: 1 };
  const trend = String((data as any)?.trend ?? "stable").toLowerCase();
  const dom = Number((data as any)?.days_on_market ?? 45);
  const inventory = Number((data as any)?.inventory ?? 1800);

  const trendScore = trend === "up" ? 85 : trend === "down" ? 40 : 62;
  const speedScore = clamp(100 - dom, 20, 100);
  const inventoryScore = clamp(100 - inventory / 40, 20, 100);
  const score = clamp(trendScore * 0.5 + speedScore * 0.3 + inventoryScore * 0.2, 0, 100);
  const demandMultiplier = clamp(0.8 + score / 100, 0.8, 1.8);
  return { score, demandMultiplier };
}

function scoreMultiplier(leadScore: number) {
  return clamp(0.7 + leadScore / 100, 0.7, 1.7);
}

function calcCloseProbability(leadScore: number, engagement: number) {
  const raw = leadScore * 0.55 + engagement * 0.45;
  return clamp(raw / 150, 0.05, 0.85);
}

export async function computeLeadPricing(input: EngineInput) {
  const weights = await getLatestWeights();
  const core = await fetchCore(input);
  if (!core.address) throw new Error("Lead/opportunity not found or missing property address");

  const behavior = await behaviorSignal(core.address, core.usageCount);
  const engagement = await engagementSignal(core.lead, core.address);
  const profile = profileSignal(core.estimatedValue, core.address);
  const market = await marketSignal(core.address);
  const intentComponent = clamp(core.intentScore, 0, 100);

  const weightedCore =
    behavior * weights.behavior_weight +
    engagement * weights.engagement_weight +
    profile * weights.profile_weight +
    market.score * weights.market_weight;
  let leadScore = clamp(weightedCore * 0.8 + intentComponent * 0.2, 0, 100);
  // Marketplace integration: blend in the AI lead score snapshot when available.
  if (core.lead?.id) {
    const { data: aiScoreRow } = await supabaseServer
      .from("lead_scores")
      .select("score")
      .eq("lead_id", core.lead.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (aiScoreRow) {
      const aiScore = clamp(Number((aiScoreRow as any).score ?? leadScore), 0, 100);
      leadScore = clamp(leadScore * 0.6 + aiScore * 0.4, 0, 100);
    }
  }

  const sMultiplier = scoreMultiplier(leadScore);
  const dMultiplier = market.demandMultiplier;
  const credits = Math.round(weights.base_price * sMultiplier * dMultiplier);

  const commissionValue = Number((core.estimatedValue * 0.025).toFixed(2));
  const closeProbability = Number(calcCloseProbability(leadScore, engagement).toFixed(4));
  const expectedRevenue = Number((commissionValue * closeProbability).toFixed(2));

  const explanation = [
    `Behavior signal: ${Math.round(behavior)}/100 from recent visits/tool usage.`,
    `Engagement signal: ${Math.round(engagement)}/100 from clicks/replies/nurture trend.`,
    `Profile signal: ${Math.round(profile)}/100 based on location and estimated home value.`,
    `Market signal: ${Math.round(market.score)}/100 from trend, speed, and inventory.`,
    `Final score ${Math.round(leadScore)}/100 sets price at ${credits} credits.`,
  ].join(" ");

  const { city, state } = parseCityStateFromAddress(core.address);

  await supabaseServer.from("lead_pricing_predictions").insert({
    opportunity_id: core.opportunity?.id ?? null,
    lead_id: core.lead?.id ?? null,
    property_address: core.address,
    city: city || null,
    state: state || null,
    model_version: weights.model_version,
    behavior_score: Number(behavior.toFixed(2)),
    engagement_score: Number(engagement.toFixed(2)),
    profile_score: Number(profile.toFixed(2)),
    market_score: Number(market.score.toFixed(2)),
    lead_score: Number(leadScore.toFixed(2)),
    score_multiplier: Number(sMultiplier.toFixed(4)),
    demand_multiplier: Number(dMultiplier.toFixed(4)),
    price_credits: credits,
    commission_value: commissionValue,
    close_probability: closeProbability,
    expected_revenue: expectedRevenue,
    explanation,
    features: {
      intent_score: intentComponent,
      usage_count: core.usageCount,
      estimated_value: core.estimatedValue,
    },
  } as any);

  return {
    lead_score: Number(leadScore.toFixed(2)),
    price_credits: credits,
    explanation,
    prediction: {
      commission_value: commissionValue,
      close_probability: closeProbability,
      expected_revenue: expectedRevenue,
    },
    model: {
      version: weights.model_version,
      weights: {
        behavior: weights.behavior_weight,
        engagement: weights.engagement_weight,
        profile: weights.profile_weight,
        market: weights.market_weight,
      },
      multipliers: {
        score_multiplier: Number(sMultiplier.toFixed(4)),
        demand_multiplier: Number(dMultiplier.toFixed(4)),
      },
    },
  };
}

export async function runLeadPricingLearningLoop() {
  const { data: rows } = await supabaseServer
    .from("lead_pricing_predictions")
    .select("lead_score,behavior_score,engagement_score,profile_score,market_score,opportunity_id")
    .gte("created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!rows?.length) {
    return { ok: true, updated: false, reason: "No prediction rows available" };
  }

  const oppIds = Array.from(
    new Set(rows.map((r: any) => String(r.opportunity_id ?? "")).filter(Boolean))
  );
  const soldSet = new Set<string>();
  if (oppIds.length) {
    const { data: soldRows } = await supabaseServer
      .from("opportunities")
      .select("id,status")
      .in("id", oppIds);
    for (const r of soldRows ?? []) {
      if (String((r as any)?.status ?? "") === "sold") soldSet.add(String((r as any).id));
    }
  }

  const sold = rows.filter((r: any) => soldSet.has(String(r.opportunity_id ?? "")));
  const unsold = rows.filter((r: any) => !soldSet.has(String(r.opportunity_id ?? "")));
  if (!sold.length || !unsold.length) {
    return { ok: true, updated: false, reason: "Not enough sold/unsold samples" };
  }

  const avg = (arr: any[], key: string) =>
    arr.reduce((s, r) => s + Number((r as any)?.[key] ?? 0), 0) / Math.max(1, arr.length);

  const deltas = {
    behavior: avg(sold, "behavior_score") - avg(unsold, "behavior_score"),
    engagement: avg(sold, "engagement_score") - avg(unsold, "engagement_score"),
    profile: avg(sold, "profile_score") - avg(unsold, "profile_score"),
    market: avg(sold, "market_score") - avg(unsold, "market_score"),
  };

  const softmaxInput = [
    Math.max(0.01, deltas.behavior + 1),
    Math.max(0.01, deltas.engagement + 1),
    Math.max(0.01, deltas.profile + 1),
    Math.max(0.01, deltas.market + 1),
  ];
  const sum = softmaxInput.reduce((a, b) => a + b, 0);
  const target = softmaxInput.map((n) => n / sum);

  const latest = await getLatestWeights();
  const blend = 0.15;
  const next = {
    behavior_weight: Number((latest.behavior_weight * (1 - blend) + target[0] * blend).toFixed(4)),
    engagement_weight: Number((latest.engagement_weight * (1 - blend) + target[1] * blend).toFixed(4)),
    profile_weight: Number((latest.profile_weight * (1 - blend) + target[2] * blend).toFixed(4)),
    market_weight: Number((latest.market_weight * (1 - blend) + target[3] * blend).toFixed(4)),
  };

  await supabaseServer.from("lead_pricing_weights").insert({
    model_version: latest.model_version,
    behavior_weight: next.behavior_weight,
    engagement_weight: next.engagement_weight,
    profile_weight: next.profile_weight,
    market_weight: next.market_weight,
    base_price: latest.base_price,
    updated_from_learning: true,
    notes: `Auto-updated from ${sold.length} sold and ${unsold.length} unsold leads`,
  } as any);

  return {
    ok: true,
    updated: true,
    samples: { sold: sold.length, unsold: unsold.length },
    previous_weights: {
      behavior: latest.behavior_weight,
      engagement: latest.engagement_weight,
      profile: latest.profile_weight,
      market: latest.market_weight,
    },
    next_weights: {
      behavior: next.behavior_weight,
      engagement: next.engagement_weight,
      profile: next.profile_weight,
      market: next.market_weight,
    },
  };
}
