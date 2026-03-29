import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email";
import { scheduleEmailSequenceForLead } from "@/lib/emailSequences";
import { recordLeadEvent, scoreLead } from "@/lib/leadScoring";
import { runLeadMarketplacePipeline } from "@/lib/leadScorePipeline";

type LeadPayload = {
  name?: string;
  email: string;
  phone?: string;
  address: string;
  agent?: string;
  source?: string;
  traffic_source?: string;
  lead_quality?: string;
};

function formatUsPhone(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LeadPayload;
    const { name, email, phone, address, agent, source, traffic_source, lead_quality } = body;
    const formattedPhone = phone ? formatUsPhone(phone) : null;

    if (!email || !address) {
      return NextResponse.json(
        { ok: false, error: "Email and address are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("leads")
      .insert({
        agent_id: agent ?? null,
        name: name || address,
        email,
        phone: formattedPhone ?? null,
        phone_number: formattedPhone ?? null,
        sms_opt_in: false,
        property_address: address,
        source: source || "landing",
        traffic_source: traffic_source ?? source ?? "landing",
        lead_quality: lead_quality ?? null,
        lead_status: "new",
        notes: null,
        rating: "warm",
        contact_frequency: "weekly",
        contact_method: "email",
        next_contact_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error inserting lead", error);
      return NextResponse.json(
        { ok: false, error: "Failed to save lead." },
        { status: 500 }
      );
    }

    if (data?.id) {
      await scheduleEmailSequenceForLead(data.id as string);
      // Trigger initial scoring on lead creation.
      try {
        await recordLeadEvent({ lead_id: data.id as any, event_type: "visit", metadata: { source: source || "landing" } });
        await runLeadMarketplacePipeline(String(data.id));
        await scoreLead(String(data.id), true);
      } catch {}
    }

    const agentEmail = process.env.AGENT_NOTIFICATION_EMAIL;
    if (agentEmail) {
      await sendEmail({
        to: agentEmail,
        subject: "New LeadSmart AI Lead",
        text: `New lead captured from landing page:

Name: ${name || "(not provided)"}
Email: ${email}
Phone: ${phone || "(not provided)"}
Address: ${address}
Agent param: ${agent || "(not provided)"}
Source: ${source || "landing"}
Timestamp: ${new Date().toISOString()}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/leads error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("leads")
      .select(
        "id,name,email,phone,phone_number,sms_opt_in,property_address,source,lead_status,notes,rating,contact_frequency,contact_method,last_contacted_at,next_contact_at,created_at,search_location,search_radius,price_min,price_max,beds,baths"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/leads error", error);
      return NextResponse.json(
        { ok: false, error: "Failed to load leads." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, leads: data ?? [] });
  } catch (e: any) {
    console.error("GET /api/leads error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      // Smart Lead Notifications fields (all optional).
      search_location?: string | null;
      search_radius?: number | string | null;
      price_min?: number | string | null;
      price_max?: number | string | null;
      beds?: number | string | null;
      baths?: number | string | null;
    };

    const id = body.id;
    const status = body.status;

    function toNullableNumber(v: any): number | null {
      if (v === undefined) return undefined as any;
      if (v === null) return null;
      if (typeof v === "string" && !v.trim()) return null;
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : null;
    }

    const searchLocation =
      body.search_location === undefined ? undefined : (body.search_location ?? null);

    const radius = toNullableNumber(body.search_radius);
    const priceMin = toNullableNumber(body.price_min);
    const priceMax = toNullableNumber(body.price_max);
    const beds = toNullableNumber(body.beds);
    const baths = toNullableNumber(body.baths);

    const hasNotifUpdates =
      searchLocation !== undefined ||
      radius !== undefined ||
      priceMin !== undefined ||
      priceMax !== undefined ||
      beds !== undefined ||
      baths !== undefined;

    if (!id || (!status && !hasNotifUpdates)) {
      return NextResponse.json(
        {
          ok: false,
          error: "id is required. Provide `status` and/or notification filter fields.",
        },
        { status: 400 }
      );
    }

    const updatePayload: any = {};
    if (status) updatePayload.lead_status = status;
    if (searchLocation !== undefined) updatePayload.search_location = searchLocation;
    if (radius !== undefined) updatePayload.search_radius = radius;
    if (priceMin !== undefined) updatePayload.price_min = priceMin;
    if (priceMax !== undefined) updatePayload.price_max = priceMax;
    if (beds !== undefined) updatePayload.beds = beds;
    if (baths !== undefined) updatePayload.baths = baths;

    const { data, error } = await supabaseServer
      .from("leads")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id,name,email,phone,property_address,source,lead_status,notes,created_at,search_location,search_radius,price_min,price_max,beds,baths"
      )
      .maybeSingle();

    if (error) {
      console.error("PATCH /api/leads error", error);
      return NextResponse.json(
        { ok: false, error: "Failed to update lead." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lead: data });
  } catch (e: any) {
    console.error("PATCH /api/leads error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

