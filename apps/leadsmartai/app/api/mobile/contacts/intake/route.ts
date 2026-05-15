import { NextResponse } from "next/server";

import { contactIntakeBodySchema } from "@/components/crm/contactIntakeSchema";
import { findBestDuplicateMatchForAgent } from "@/lib/contact-intake/findDuplicateCandidates";
import { runContactIngestion } from "@/lib/contact-intake/ingestionPipeline";
import { toLeadLike } from "@/lib/contact-intake/leadLike";
import { formatUsPhoneDigits } from "@/lib/contact-intake/phone";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Mobile-app contact intake. Mirrors `/api/dashboard/contacts/intake`
 * but authenticates via the mobile bearer-token + agents-row pattern
 * (`requireMobileAgent`) instead of the dashboard cookie session.
 *
 * `plan_type` is read off the agents row inline because the mobile
 * auth helper intentionally returns the minimal `{ userId, agentId }`
 * context — keeping that small avoids penalizing every existing mobile
 * endpoint with an extra column read.
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = contactIntakeBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const phone = (formatUsPhoneDigits(body.phone ?? "") ?? body.phone?.trim()) || null;
    const fields = {
      name: body.name?.trim() || null,
      email: body.email?.trim() || null,
      phone,
      property_address: body.property_address?.trim() || null,
      notes: body.notes?.trim() || null,
      source: body.source?.trim() || "mobile_app",
    };

    const incoming = toLeadLike(
      {
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        property_address: fields.property_address,
        notes: fields.notes,
      },
      auth.ctx.agentId
    );

    const dup = await findBestDuplicateMatchForAgent(auth.ctx.agentId, incoming);
    if (dup && !body.forceCreate) {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE_CANDIDATE",
          duplicate: { leadId: dup.leadId, score: dup.score, reasons: dup.reasons },
          message: "A similar contact already exists. Confirm to create anyway or cancel.",
        },
        { status: 409 }
      );
    }

    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("plan_type")
      .eq("id", auth.ctx.agentId)
      .maybeSingle();
    const planType = String((agentRow as { plan_type?: string } | null)?.plan_type ?? "free").toLowerCase();

    const result = await runContactIngestion({
      agentId: auth.ctx.agentId,
      planType,
      fields,
      intakeChannel: "mobile",
      duplicateStrategy: dup && body.forceCreate ? "create_anyway" : "skip",
      skipEnrichment: false,
    });

    if (result.action === "skipped") {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE_CANDIDATE",
          duplicate: { leadId: result.duplicateLeadId, score: result.score },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, leadId: result.leadId, action: result.action });
  } catch (e) {
    console.error("[mobile/contacts/intake] failed", e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : "Server error";
    const status = /upgrade|not available|Premium|Pro/i.test(msg) ? 402 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
