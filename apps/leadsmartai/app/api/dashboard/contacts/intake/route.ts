import { NextResponse } from "next/server";

import { contactIntakeBodySchema } from "@/components/crm/contactIntakeSchema";
import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { findBestDuplicateMatchForAgent } from "@/lib/contact-intake/findDuplicateCandidates";
import { runContactIngestion } from "@/lib/contact-intake/ingestionPipeline";
import { toLeadLike } from "@/lib/contact-intake/leadLike";
import { formatUsPhoneDigits } from "@/lib/contact-intake/phone";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const json = await req.json().catch(() => ({}));
    const parsed = contactIntakeBodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { ok: false, error: "Validation failed", details: msg },
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
      source: body.source?.trim() || "manual_entry",
    };

    const incoming = toLeadLike(
      {
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        property_address: fields.property_address,
        notes: fields.notes,
      },
      auth.agentId
    );

    const dup = await findBestDuplicateMatchForAgent(auth.agentId, incoming);
    if (dup && !body.forceCreate) {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE_CANDIDATE",
          duplicate: {
            leadId: dup.leadId,
            score: dup.score,
            reasons: dup.reasons,
          },
          message: "A similar contact already exists. Confirm to create anyway or cancel.",
        },
        { status: 409 }
      );
    }

    const result = await runContactIngestion({
      agentId: auth.agentId,
      planType: auth.planType,
      fields,
      intakeChannel: "manual",
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

    return NextResponse.json({
      ok: true,
      leadId: result.leadId,
      action: result.action,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /upgrade|not available|Premium|Pro/i.test(msg) ? 402 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
