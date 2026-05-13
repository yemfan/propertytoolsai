import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { suggestAdCreative } from "@/lib/leads-gen/ads-suggest";
import { loadSubjectDetail } from "@/lib/leads-gen/subjects";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Single Claude call. Conservative budget for slow first-token-latency.
export const maxDuration = 60;

const bodySchema = z.object({
  /** Required free-form brief from the agent. */
  brief: z.string().min(1).max(2_000),
  /** Optional subject id — when present, we hydrate listing details
   *  (address, price, city) for the model so it doesn't invent. */
  subjectId: z.string().min(1).optional(),
  /** Optional trigger label — same vocab as the Quick Post wizard. */
  trigger: z.string().max(64).optional(),
});

/**
 * POST /api/leads-gen/ads/suggest
 *
 * Generates Lead Ad body + headline candidates from the agent's
 * brief. Returns { body, headline, variants[] } — the wizard
 * populates its inputs from `body` + `headline` and offers a
 * "Try a different angle" cycle through `variants`.
 *
 * Plan gate: Premium (same as the rest of Run Ads).
 *
 * The endpoint accepts an optional `subjectId` so the model can be
 * grounded in the listing's actual address / price / city without
 * the agent having to retype them. Free-typed brief alone still
 * works for "custom" campaigns.
 */
export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const planType = auth.planType.toLowerCase();
    if (planType !== "premium" && planType !== "enterprise") {
      return NextResponse.json(
        { ok: false, error: "Run Ads is a Premium feature." },
        { status: 402 },
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Hydrate optional subject context.
    let subjectContext: {
      propertyAddress: string | null;
      city: string | null;
      state: string | null;
      listPrice: number | null;
      listingStartDate: string | null;
    } | null = null;
    if (parsed.data.subjectId) {
      const subject = await loadSubjectDetail(parsed.data.subjectId, auth.agentId);
      if (subject) {
        // Listing-type subjects carry these; synthetic ones (market_update,
        // testimonial, custom) don't — those just lean on the brief.
        const s = subject as Record<string, unknown>;
        subjectContext = {
          propertyAddress:
            (typeof s.property_address === "string" && s.property_address) || null,
          city: (typeof s.city === "string" && s.city) || null,
          state: (typeof s.state === "string" && s.state) || null,
          listPrice: typeof s.list_price === "number" ? s.list_price : null,
          listingStartDate:
            (typeof s.listing_start_date === "string" && s.listing_start_date) || null,
        };
      }
    }

    // Agent name — only loaded if we ended up with a subject (since the
    // free-typed brief case usually doesn't want first-person anchoring).
    let agentName: string | null = null;
    try {
      const { data: agentRow } = await supabaseAdmin
        .from("agents")
        .select("brand_name, brokerage")
        .eq("id", auth.agentId)
        .maybeSingle();
      const row = agentRow as { brand_name: string | null; brokerage: string | null } | null;
      agentName = row?.brand_name || row?.brokerage || null;
    } catch {
      // best-effort
    }

    const out = await suggestAdCreative({
      brief: parsed.data.brief,
      context: {
        ...subjectContext,
        agentName,
        trigger: parsed.data.trigger ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      body: out.body,
      headline: out.headline,
      variants: out.variants,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Suggest failed";
    console.error("[leads-gen/ads/suggest]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
