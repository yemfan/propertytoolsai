import { NextResponse } from "next/server";

import {
  aiExtractContacts,
  asImageMediaType,
  type ContactDraft,
} from "@/lib/contact-intake/aiExtractContacts";
import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { findBestDuplicateMatchForAgent } from "@/lib/contact-intake/findDuplicateCandidates";
import { toLeadLike } from "@/lib/contact-intake/leadLike";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Claude PDF / vision calls are slow on big inputs — give the function
// room to breathe past the platform's 60s default.
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap — covers most rosters
const MAX_CONTACTS = 100; // sanity cap to bound DB writes downstream

type ExtractedRow = ContactDraft & {
  /** Stable client-side row id. Lets the preview UI track edits / removals. */
  rowKey: string;
  duplicateContactId: string | null;
  duplicateScore: number | null;
};

/**
 * Stage 1 of the AI file-extract intake flow.
 *
 * Accepts a single multipart file:
 *   - PDF  (application/pdf)
 *   - Image (image/jpeg | png | webp | gif)
 *   - Text (text/plain, .vcf, .md, etc — anything we can decode as utf-8)
 *
 * Returns the AI-extracted contact list along with a duplicate-detection
 * hint per row so the preview UI can flag likely duplicates before the
 * user clicks save. We also persist a `contact_import_jobs` row so the
 * finalize step can reference it for the audit trail.
 *
 * No `contacts` rows are written here. The save step
 * (POST /api/dashboard/contacts/import-file/save) is what writes.
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

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Expected multipart form upload" },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Missing file field" },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "File is empty" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "File too large (max 20 MB)" },
        { status: 400 },
      );
    }

    const mime = (file.type || "").toLowerCase();
    const ext = file.name.toLowerCase().split(".").pop() ?? "";

    let contacts: ContactDraft[];
    let sourceKind: "pdf" | "image" | "text";

    if (mime === "application/pdf" || ext === "pdf") {
      sourceKind = "pdf";
      const bytes = new Uint8Array(await file.arrayBuffer());
      contacts = await aiExtractContacts({ kind: "pdf", bytes });
    } else if (mime.startsWith("image/") || isImageExt(ext)) {
      const mediaType = asImageMediaType(mime) ?? imageMediaTypeFromExt(ext);
      if (!mediaType) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Unsupported image type. Use JPEG, PNG, WEBP, or GIF (HEIC isn't supported yet).",
          },
          { status: 400 },
        );
      }
      sourceKind = "image";
      const bytes = new Uint8Array(await file.arrayBuffer());
      contacts = await aiExtractContacts({ kind: "image", bytes, mediaType });
    } else if (mime.startsWith("text/") || isTextExt(ext)) {
      sourceKind = "text";
      const text = await file.text();
      if (!text.trim()) {
        return NextResponse.json(
          { ok: false, error: "Text file is empty" },
          { status: 400 },
        );
      }
      contacts = await aiExtractContacts({ kind: "text", text });
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unsupported file type. Upload a PDF, image (JPEG/PNG/WEBP), or text file (.txt, .vcf, .md).",
        },
        { status: 400 },
      );
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No contacts found in the file. Make sure names / emails / phone numbers are visible.",
        },
        { status: 422 },
      );
    }

    // Trim to the sanity cap. We keep the first N — the model returns
    // rows roughly in source order, so this preserves the most
    // visually-prominent rows.
    const trimmed = contacts.slice(0, MAX_CONTACTS);
    const truncated = contacts.length > MAX_CONTACTS;

    // Duplicate hints. One round-trip per row but the matcher is
    // already designed for per-row use in the CSV preview path.
    const enriched: ExtractedRow[] = await Promise.all(
      trimmed.map(async (c, idx) => {
        let duplicateContactId: string | null = null;
        let duplicateScore: number | null = null;
        try {
          const dup = await findBestDuplicateMatchForAgent(
            auth.agentId,
            toLeadLike(
              {
                name: c.name ?? undefined,
                email: c.email ?? undefined,
                phone: c.phone ?? undefined,
                property_address: c.address ?? undefined,
              },
              auth.agentId,
            ),
          );
          if (dup) {
            duplicateContactId = dup.leadId;
            duplicateScore = dup.score;
          }
        } catch {
          // Duplicate hints are advisory — never block extraction.
        }
        return { ...c, rowKey: `r${idx}`, duplicateContactId, duplicateScore };
      }),
    );

    // Persist a preview job for audit/history.
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("contact_import_jobs")
      .insert({
        agent_id: auth.agentId,
        created_by: auth.userId,
        intake_channel: "ai_file",
        status: "preview",
        file_name: file.name || "upload",
        scan_draft: {
          source_kind: sourceKind,
          mime,
          extracted_count: contacts.length,
          truncated,
          extracted_at: new Date().toISOString(),
        },
      } as Record<string, unknown>)
      .select("id")
      .single();

    if (jobErr) throw jobErr;
    const jobId = String((job as { id?: string }).id ?? "");

    return NextResponse.json({
      ok: true,
      jobId,
      sourceKind,
      contacts: enriched,
      truncated,
      totalExtracted: contacts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    console.error("[contacts/import-file/extract]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function isImageExt(ext: string): boolean {
  return ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "gif";
}

function isTextExt(ext: string): boolean {
  return (
    ext === "txt" ||
    ext === "vcf" ||
    ext === "md" ||
    ext === "log" ||
    ext === "json" ||
    ext === ""
  );
}

function imageMediaTypeFromExt(
  ext: string,
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}
