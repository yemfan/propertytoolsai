import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { finalizeImportJob } from "@/lib/contact-intake/importJobService";
import type { DuplicateStrategy } from "@/lib/contact-intake/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  jobId: z.string().uuid(),
  duplicateStrategy: z.enum(["skip", "merge", "create_anyway"]),
  enrichRows: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json({ ok: false, error: "CRM imports require Pro or higher." }, { status: 402 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const summary = await finalizeImportJob({
      agentId: auth.agentId,
      planType: auth.planType,
      jobId: parsed.data.jobId,
      duplicateStrategy: parsed.data.duplicateStrategy as DuplicateStrategy,
      enrichRows: parsed.data.enrichRows,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Finalize failed";
    const status = /upgrade|Premium|Pro|not available/i.test(msg) ? 402 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
