import { NextResponse } from "next/server";
import { getCityData, normalizeCityState } from "@/lib/cityDataEngine";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cityParam = String(url.searchParams.get("city") ?? "").trim();
    const stateParam = String(url.searchParams.get("state") ?? "").trim();
    const forceRefresh = String(url.searchParams.get("refresh") ?? "false").toLowerCase() === "true";
    const maxAgeHours = Number(url.searchParams.get("maxAgeHours") ?? "24");

    if (!cityParam) {
      return NextResponse.json(
        { ok: false, error: "city query param is required" },
        { status: 400 }
      );
    }

    const normalized = normalizeCityState(cityParam, stateParam);
    if (!normalized.city || !normalized.state) {
      return NextResponse.json(
        { ok: false, error: "valid city and state are required" },
        { status: 400 }
      );
    }

    const data = await getCityData({
      city: normalized.city,
      state: normalized.state,
      forceRefresh,
      maxAgeHours,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
