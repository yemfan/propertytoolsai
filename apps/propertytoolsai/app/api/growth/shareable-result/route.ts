import { NextResponse } from "next/server";
import { createShareableResult } from "@/lib/growth/shareableResults";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      brand?: string;
      tool_slug?: string;
      title?: string;
      summary?: string;
      result?: Record<string, unknown>;
      ref_code?: string | null;
      ttl_days?: number;
    };

    const brand = body.brand === "leadsmart" ? "leadsmart" : "propertytools";
    const toolSlug = String(body.tool_slug ?? "tool").trim().slice(0, 120);
    const title = String(body.title ?? "Shared result").trim().slice(0, 200);
    const summary = body.summary ? String(body.summary).slice(0, 500) : undefined;
    const resultJson = body.result && typeof body.result === "object" ? body.result : {};

    const row = await createShareableResult({
      brand,
      toolSlug,
      title,
      summary,
      resultJson,
      refCode: body.ref_code ?? null,
      ttlDays: body.ttl_days,
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      sharePath: `/result/${row.id}`,
    });
  } catch (e: any) {
    console.error("shareable-result POST", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
