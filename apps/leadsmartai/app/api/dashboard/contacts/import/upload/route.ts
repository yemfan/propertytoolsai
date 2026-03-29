import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { createImportJobFromCsv, parseCsvText } from "@/lib/contact-intake/importJobService";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "CRM imports require Pro or higher." },
        { status: 402 }
      );
    }

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: "Expected multipart form upload" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file field" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "File too large (max 5 MB)" }, { status: 400 });
    }

    const text = await file.text();
    const { headers, rows } = parseCsvText(text);

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "CSV has no data rows" }, { status: 400 });
    }

    if (rows.length > 10_000) {
      return NextResponse.json({ ok: false, error: "Too many rows (max 10,000)" }, { status: 400 });
    }

    const { jobId } = await createImportJobFromCsv({
      agentId: auth.agentId,
      userId: auth.userId,
      fileName: file.name || "import.csv",
      rows,
    });

    return NextResponse.json({
      ok: true,
      jobId,
      headers,
      rowCount: rows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
