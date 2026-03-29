import { NextResponse } from "next/server";
import { z } from "zod";

import { extractBusinessCardFieldsFromText } from "@/lib/contact-intake/businessCardOcr";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Stage 1 — OCR / text extraction placeholder. Does **not** create a CRM lead.
 * Client must call POST /api/mobile/contacts/scan/finalize with edited fields.
 */
const bodySchema = z.object({
  rawText: z.string().max(50_000).optional(),
  /** Integration point: pass image URL or base64 for future OCR providers. */
  imageBase64: z.string().max(12_000_000).optional(),
  ocrProvider: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, success: false, error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rawText = parsed.data.rawText ?? "";
    if (!rawText.trim() && !parsed.data.imageBase64) {
      return NextResponse.json(
        { ok: false, success: false, error: "Provide rawText from OCR or imageBase64 for future processing." },
        { status: 400 }
      );
    }

    const extracted = rawText.trim()
      ? extractBusinessCardFieldsFromText(rawText)
      : {
          name: null,
          email: null,
          phone: null,
          company: null,
          title: null,
          rawLines: [] as string[],
        };

    const { data: job, error } = await supabaseAdmin
      .from("contact_import_jobs")
      .insert({
        agent_id: auth.ctx.agentId,
        created_by: auth.ctx.userId,
        intake_channel: "business_card",
        status: "preview",
        scan_draft: {
          ocrProvider: parsed.data.ocrProvider ?? "placeholder_text",
          hasImage: Boolean(parsed.data.imageBase64),
          rawText: rawText.slice(0, 50_000),
          extracted,
          createdAt: new Date().toISOString(),
        },
      } as Record<string, unknown>)
      .select("id")
      .single();

    if (error) throw error;

    const jobId = String((job as { id?: string }).id ?? "");
    if (!jobId) throw new Error("Failed to create scan draft");

    return NextResponse.json({
      ok: true,
      success: true,
      jobId,
      suggested: {
        name: extracted.name,
        email: extracted.email,
        phone: extracted.phone,
        company: extracted.company,
        title: extracted.title,
        rawLines: extracted.rawLines,
      },
      message:
        "Review and edit fields in the app, then call /api/mobile/contacts/scan/finalize. Nothing was saved to the CRM yet.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[mobile/contacts/scan/draft]", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
