import { NextResponse } from "next/server";
import { z } from "zod";

import { lookupProperty } from "@/lib/leads-gen/property-lookup";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  input: z.string().min(3).max(500),
});

/**
 * POST /api/mobile/leads-gen/lookup-property
 *
 * Mobile-side counterpart to /api/leads-gen/lookup-property.
 * Same Pro+ gate, same response shape — just Bearer-auth and the
 * `success` envelope flag.
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("plan_type")
      .eq("id", auth.ctx.agentId)
      .maybeSingle();
    const planType = (
      (agentRow as { plan_type: string | null } | null)?.plan_type ?? "free"
    ).toLowerCase();
    if (planType === "free") {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Generate Leads requires Pro or higher.",
        },
        { status: 402 },
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Invalid body",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await lookupProperty(parsed.data.input);
    return NextResponse.json({ ok: true, success: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    console.error("[mobile/leads-gen/lookup-property]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
