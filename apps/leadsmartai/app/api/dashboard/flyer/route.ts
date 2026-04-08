import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getPropertyByAddress, getLatestSnapshot } from "@/lib/propertyService";
import { getPropertyData } from "@/lib/getPropertyData";

export const runtime = "nodejs";

/**
 * POST — Fetch property data + generate AI description for flyer builder.
 */
export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { address?: string };
    const address = String(body.address ?? "").trim();
    if (!address) return NextResponse.json({ ok: false, error: "Address is required" }, { status: 400 });

    // Fetch property data
    await getPropertyData(address, false).catch(() => null);
    const property = await getPropertyByAddress(address);
    if (!property) return NextResponse.json({ ok: false, error: "Property not found" }, { status: 404 });

    const snapshot = await getLatestSnapshot(property.id).catch(() => null);

    const propertyData = {
      address: property.address,
      city: property.city,
      state: property.state,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      propertyType: property.property_type,
      yearBuilt: property.year_built,
      estimatedValue: snapshot?.estimated_value ? Number(snapshot.estimated_value) : null,
      propertyId: property.id,
    };

    // Generate AI description
    const description = await generatePropertyDescription(propertyData);

    return NextResponse.json({ ok: true, property: propertyData, description });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

async function generatePropertyDescription(p: {
  address: string;
  city: string | null;
  state: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
  estimatedValue: number | null;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback = `Welcome to ${p.address}. This ${p.beds ?? ""}bd/${p.baths ?? ""}ba ${p.propertyType ?? "home"} offers ${p.sqft ? p.sqft.toLocaleString() + " sqft of" : ""} comfortable living space${p.yearBuilt ? `, built in ${p.yearBuilt}` : ""}. Schedule a tour today!`;

  if (!apiKey) return fallback;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: "You are a real estate marketing copywriter. Write a compelling 2-3 sentence property description for an open house flyer. Be professional, warm, and highlight key features. Do not use exclamation marks excessively. Return ONLY the description text, no quotes or labels." },
          { role: "user", content: `Property: ${p.address}, ${p.city ?? ""} ${p.state ?? ""}. ${p.beds ?? "?"}bd/${p.baths ?? "?"}ba, ${p.sqft ? p.sqft.toLocaleString() + " sqft" : "size unknown"}, ${p.propertyType ?? "residential"}, built ${p.yearBuilt ?? "unknown"}.` },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}
