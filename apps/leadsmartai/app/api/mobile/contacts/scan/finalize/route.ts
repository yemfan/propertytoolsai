import { NextResponse } from "next/server";
import { z } from "zod";

import { runContactIngestion } from "@/lib/contact-intake/ingestionPipeline";
import { formatUsPhoneDigits } from "@/lib/contact-intake/phone";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  jobId: z.string().uuid(),
  name: z.string().max(200).optional().nullable(),
  email: z.string().max(320).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  property_address: z.string().max(500).optional().nullable(),
  notes: z.string().max(8000).optional().nullable(),
});

/**
 * Stage 2 — User-reviewed contact. This is the only path that creates/updates CRM leads from a card scan.
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

    const planType = String((agentRow as { plan_type?: string } | null)?.plan_type ?? "free").toLowerCase();

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, success: false, error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const b = parsed.data;
    const name = (b.name ?? "").trim();
    const email = (b.email ?? "").trim();
    const phoneRaw = (b.phone ?? "").trim();
    const property_address = (b.property_address ?? "").trim() || null;
    const notes = (b.notes ?? "").trim() || null;

    if (!name && !email && !phoneRaw) {
      return NextResponse.json(
        { ok: false, success: false, error: "Enter at least a name, email, or phone number." },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, success: false, error: "Invalid email address." }, { status: 400 });
    }

    const { data: job, error: jErr } = await supabaseAdmin
      .from("contact_import_jobs")
      .select("id, agent_id, intake_channel, status")
      .eq("id", b.jobId)
      .maybeSingle();

    if (jErr) throw jErr;
    if (!job || String((job as { agent_id?: string }).agent_id) !== auth.ctx.agentId) {
      return NextResponse.json({ ok: false, success: false, error: "Scan job not found" }, { status: 404 });
    }
    if ((job as { intake_channel?: string }).intake_channel !== "business_card") {
      return NextResponse.json({ ok: false, success: false, error: "Invalid job type" }, { status: 400 });
    }

    const phone = (formatUsPhoneDigits(phoneRaw) ?? phoneRaw) || null;

    const result = await runContactIngestion({
      agentId: auth.ctx.agentId,
      planType,
      fields: {
        name: name || null,
        email: email || null,
        phone,
        property_address,
        notes,
        source: "business_card",
      },
      intakeChannel: "business_card",
      duplicateStrategy: "merge",
      importJobId: b.jobId,
      skipEnrichment: false,
    });

    await supabaseAdmin
      .from("contact_import_jobs")
      .update({
        status: "completed",
        summary: {
          lead_id: result.leadId,
          action: result.action,
          finished_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", b.jobId);

    return NextResponse.json({
      ok: true,
      success: true,
      leadId: result.leadId,
      action: result.action,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /upgrade|Premium|Pro|not available/i.test(msg) ? 402 : 500;
    return NextResponse.json({ ok: false, success: false, error: msg }, { status });
  }
}
