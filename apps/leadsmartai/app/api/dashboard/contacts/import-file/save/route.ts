import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { runContactIngestion } from "@/lib/contact-intake/ingestionPipeline";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// 100-row max × per-row dedup + enrichment can run long. Same ceiling
// the extract step uses for symmetry.
export const maxDuration = 300;

const contactSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const bodySchema = z.object({
  jobId: z.string().uuid().nullable().optional(),
  duplicateStrategy: z.enum(["skip", "merge", "create_anyway"]).default("skip"),
  contacts: z.array(contactSchema).min(1).max(100),
});

/**
 * Stage 2 of the AI file-extract intake flow.
 *
 * Takes the edited contact list and runs each row through the existing
 * `runContactIngestion` pipeline — same dedup, enrichment, normalization,
 * and activity-log path the CSV importer uses. This is intentional:
 * AI-extracted rows shouldn't bypass any of the post-create work the
 * CRM relies on (completeness scoring, marketplace pipeline, etc.).
 *
 * `jobId` is optional — if the client passes the preview job id from
 * the extract step, we mark the job as completed with a summary. If
 * not passed, the save still works but no audit row is updated. We
 * never *require* the job id because the user can edit-and-save twice
 * in a single session and the job state is just for history.
 */
export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "AI extraction requires Pro or higher." },
        { status: 402 },
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid body",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { jobId, duplicateStrategy, contacts } = parsed.data;

    // Notes field is a free-form combo: company / title / source notes.
    // Concatenate into the single `notes` column on contacts, matching
    // how the business-card scan flow assembles notes.
    let inserted = 0;
    let merged = 0;
    let skipped = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    for (const c of contacts) {
      const composedNotes = composeNotes(c);
      const name = (c.name ?? "").trim() || null;
      const email = (c.email ?? "").trim() || null;
      const phone = (c.phone ?? "").trim() || null;
      const address = (c.address ?? "").trim() || null;

      if (!name && !email && !phone) {
        skipped += 1;
        continue;
      }

      try {
        const result = await runContactIngestion({
          agentId: auth.agentId,
          planType: auth.planType,
          fields: {
            name,
            email,
            phone,
            property_address: address,
            notes: composedNotes,
            source: "ai_file_extract",
          },
          intakeChannel: "manual_batch",
          duplicateStrategy,
          importJobId: jobId ?? null,
          // AI-extracted rows are already fresh from a manual upload —
          // skip the per-row OpenAI enrichment to keep save latency
          // reasonable. The marketplace pipeline still runs.
          skipEnrichment: true,
        });

        if (result.action === "inserted") inserted += 1;
        else if (result.action === "merged") merged += 1;
        else if (result.action === "skipped") skipped += 1;
      } catch (e) {
        errors += 1;
        errorMessages.push(e instanceof Error ? e.message : "Unknown error");
        // Keep going — one bad row shouldn't block the rest.
      }
    }

    // Update import-job audit row if we have one.
    if (jobId) {
      try {
        await supabaseAdmin
          .from("contact_import_jobs")
          .update({
            status: "completed",
            summary: {
              inserted,
              merged,
              skipped,
              errors,
              finished_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq("id", jobId)
          .eq("agent_id", auth.agentId);
      } catch {
        // Audit failure mustn't fail the save — rows are already in
        // contacts at this point.
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      merged,
      skipped,
      errors,
      errorMessages: errorMessages.slice(0, 5),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    console.error("[contacts/import-file/save]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function composeNotes(c: {
  company?: string | null;
  title?: string | null;
  notes?: string | null;
}): string | null {
  const parts: string[] = [];
  if (c.company?.trim() && c.title?.trim()) {
    parts.push(`${c.title.trim()} @ ${c.company.trim()}`);
  } else if (c.company?.trim()) {
    parts.push(c.company.trim());
  } else if (c.title?.trim()) {
    parts.push(c.title.trim());
  }
  if (c.notes?.trim()) parts.push(c.notes.trim());
  return parts.length ? parts.join(" — ") : null;
}
