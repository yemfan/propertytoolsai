import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().max(200).trim().optional().nullable(),
  email: z.string().email().max(320).trim(),
  phone: z.string().max(40).trim().optional().nullable(),
  address: z.string().min(5).max(500).trim(),
  property_type: z.string().max(120).optional().nullable(),
  beds: z.number().optional().nullable(),
  baths: z.number().optional().nullable(),
  living_area_sqft: z.number().optional().nullable(),
  lot_size_sqft: z.number().optional().nullable(),
  year_built: z.number().optional().nullable(),
  condition: z.string().max(80).optional().nullable(),
  estimate_value: z.number(),
  estimate_low: z.number(),
  estimate_high: z.number(),
  confidence_score: z.number().optional().nullable(),
  source: z.string().max(80).optional(),
});

/**
 * POST /api/home-value/lead — save funnel contact + estimate to `home_value_leads` (flat columns).
 */
export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await getUserFromRequest(req);

    const d = parsed.data;
    const row = {
      name: d.name?.trim() || null,
      email: d.email.toLowerCase(),
      phone: d.phone?.trim() || null,
      address: d.address.trim(),
      property_type: d.property_type?.trim() || null,
      beds: d.beds ?? null,
      baths: d.baths ?? null,
      living_area_sqft: d.living_area_sqft ?? null,
      lot_size_sqft: d.lot_size_sqft ?? null,
      year_built: d.year_built ?? null,
      condition: d.condition?.trim() || null,
      estimate_value: d.estimate_value,
      estimate_low: d.estimate_low,
      estimate_high: d.estimate_high,
      confidence_score: d.confidence_score ?? null,
      source: d.source?.trim() || "home_value_funnel",
    };

    const { data, error } = await supabaseServer.from("home_value_leads").insert(row).select("id").maybeSingle();

    if (error) {
      console.error("[home-value/lead]", error);
      return NextResponse.json(
        { ok: false, error: "Could not save your details. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (e: unknown) {
    console.error("POST /api/home-value/lead", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
