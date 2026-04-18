import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  commitSphereRows,
  parseSphereCsv,
  type CommitRow,
} from "@/lib/contacts/import";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Two-step CSV import:
 *   - POST multipart/form-data with `file` → parse and return preview rows
 *     (no writes).
 *   - POST application/json with { rows: CommitRow[] } → insert after the
 *     user has confirmed per-row anniversary opt-ins.
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "Max 5 MB CSV" }, { status: 413 });
      }
      const text = await file.text();
      const parsed = parseSphereCsv(text);
      return NextResponse.json({ ok: true, parsed });
    }

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { rows?: CommitRow[] };
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length) {
        return NextResponse.json({ ok: false, error: "No rows" }, { status: 400 });
      }
      const result = await commitSphereRows(agentId, rows);
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported content type" },
      { status: 415 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("sphere/import POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
