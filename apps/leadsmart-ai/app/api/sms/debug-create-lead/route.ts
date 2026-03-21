import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function formatUsPhone(input: string) {
  const digits = input.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Dev-only helper: create a lead with sms consent for webhook testing.
// POST /api/sms/debug-create-lead { phone: "+1...", property_address: "...", name?: "...", email?: "..." }
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      phone?: string;
      property_address?: string;
      name?: string;
      email?: string;
    };

    const phoneFormatted = formatUsPhone(String(body.phone ?? "").trim());
    const propertyAddress = String(body.property_address ?? "").trim();
    if (!phoneFormatted || !propertyAddress) {
      return NextResponse.json(
        { ok: false, error: "phone (valid US) and property_address are required" },
        { status: 400 }
      );
    }

    const email =
      String(body.email ?? "").trim() ||
      `sms-test-${Date.now()}@example.com`;

    const name = String(body.name ?? "").trim() || "SMS Lead Test";

    const { data, error } = await supabaseServer
      .from("leads")
      .insert({
        agent_id: null,
        name,
        email,
        phone: phoneFormatted,
        property_address: propertyAddress,
        source: "sms_webhook_test",
        lead_status: "new",
        notes: null,
        rating: "warm",
        contact_frequency: "weekly",
        contact_method: "sms",
        next_contact_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        automation_disabled: false,
      } as any)
      .select("id,phone,contact_method,rating,automation_disabled,created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, lead: data ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

