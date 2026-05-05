import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { extractOfferFromPdf } from "@/lib/offers/extractOfferFromPdf";
import { isAnthropicConfigured } from "@/lib/anthropic";

export const runtime = "nodejs";
// Claude PDF extraction can take 15-40s on dense purchase agreements.
// Default 10s timeout would cut the call short before we get a response.
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/dashboard/offers/parse-pdf
 *
 * Multipart upload with a single `file` field (a PDF of an offer or
 * purchase agreement). Returns the same ParsedOffer shape as the
 * sibling /api/dashboard/offers/parse text endpoint so the upload
 * client only renders one review screen regardless of input format.
 *
 * Stateless: the PDF is NOT persisted. We read it into memory,
 * extract via Claude, and drop it. Same privacy posture as the
 * existing transactions/extract-contract route.
 *
 * Errors come back as 4xx/5xx with a user-visible message the upload
 * client renders above the file picker.
 */
export async function POST(req: Request) {
  try {
    await getCurrentAgentContext(); // auth check — throws on 401

    if (!isAnthropicConfigured()) {
      return NextResponse.json(
        { ok: false, error: "AI extraction isn't enabled on this environment." },
        { status: 503 },
      );
    }

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Expected multipart form upload." },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file field." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PDF too large (max 5 MB). Trim to the offer + contingency pages." },
        { status: 400 },
      );
    }

    const looksLikePdf =
      file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) {
      return NextResponse.json(
        { ok: false, error: "Only PDF files are supported. For other formats, paste the text instead." },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await extractOfferFromPdf(bytes);

    return NextResponse.json({ ok: true, parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/offers/parse-pdf:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
