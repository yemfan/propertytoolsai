import { NextResponse } from "next/server";
import {
  resolveProperty,
  createPropertyReport,
} from "@/lib/services/propertyService";

type Body = {
  address: string;
};

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";

    const { address } = (await req.json()) as Body;
    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const { property, property_id } = await resolveProperty(
      address.trim(),
      forceRefresh
    );

    const price = property.price ?? 0;
    const estimated_value = price ? price * 1.03 : null;

    await createPropertyReport({
      property_id,
      source: "home_value",
      estimated_value,
      metrics_json: { property },
    });

    return NextResponse.json({
      ok: true,
      property,
      estimated_value,
    });
  } catch (e: any) {
    console.error("home-value error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

