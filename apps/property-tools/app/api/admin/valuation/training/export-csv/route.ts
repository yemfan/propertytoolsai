import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { rowsToCsv } from "@/lib/valuation-training/csv";
import type { ValuationTrainingExportFilters } from "@/lib/valuation-training/types";
import { getTrainingDataset, recordTrainingExport } from "@/lib/valuation-training/service";

export const runtime = "nodejs";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "export";
}

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      filters?: ValuationTrainingExportFilters;
      exportName?: string;
      skipAuditLog?: boolean;
    };
    const filters = body?.filters ?? {};
    const exportName =
      body?.exportName?.trim() || `valuation_training_${new Date().toISOString().slice(0, 10)}`;

    const rows = await getTrainingDataset(filters);

    if (!body?.skipAuditLog) {
      try {
        await recordTrainingExport({
          exportName,
          rowCount: rows.length,
          filters,
          schemaVersion: "v1",
          fileFormat: "csv",
          createdBy: profile.id,
        });
      } catch (auditErr) {
        console.warn("valuation training export audit log failed:", auditErr);
      }
    }

    const csv = rowsToCsv(rows as unknown as Record<string, unknown>[]);
    const fileBase = safeFilename(exportName);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
      },
    });
  } catch (error) {
    console.error("valuation training export csv error:", error);
    return NextResponse.json({ success: false, error: "Failed to export training CSV" }, { status: 500 });
  }
}
