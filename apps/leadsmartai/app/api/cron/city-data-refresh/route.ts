import { NextResponse } from "next/server";
import { refreshAllCitiesDaily } from "@/lib/cityDataEngine";
import { verifyCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await refreshAllCitiesDaily();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
