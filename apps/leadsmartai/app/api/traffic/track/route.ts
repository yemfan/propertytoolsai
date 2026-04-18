import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      event_type?: string;
      page_path?: string;
      city?: string | null;
      source?: string | null;
      campaign?: string | null;
      contact_id?: string | number | null;
      lead_quality?: string | null;
      metadata?: Record<string, unknown>;
    };

    const eventType = String(body.event_type ?? "").trim();
    const pagePath = String(body.page_path ?? "").trim();
    if (!eventType || !pagePath) {
      return NextResponse.json({ ok: false, error: "event_type and page_path are required" }, { status: 400 });
    }

    const metadata = { ...(body.metadata ?? {}) } as Record<string, unknown>;
    if (body.lead_quality) metadata.lead_quality = body.lead_quality;

    const { error } = await supabaseServer.from("traffic_events").insert({
      event_type: eventType,
      page_path: pagePath,
      city: body.city ?? null,
      source: body.source ?? null,
      campaign: body.campaign ?? null,
      contact_id: body.contact_id ? Number(body.contact_id) : null,
      metadata,
    } as any);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

