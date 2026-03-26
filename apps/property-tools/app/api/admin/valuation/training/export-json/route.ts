import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import type { ValuationTrainingExportFilters } from "@/lib/valuation-training/types";
import { getTrainingDataset, recordTrainingExport } from "@/lib/valuation-training/service";

export const runtime = "nodejs";

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
          fileFormat: "json",
          createdBy: profile.id,
        });
      } catch (auditErr) {
        console.warn("valuation training export audit log failed:", auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      exportName,
      rowCount: rows.length,
      schemaVersion: "v1",
      rows,
    });
  } catch (error) {
    console.error("valuation training export json error:", error);
    return NextResponse.json({ success: false, error: "Failed to export training JSON" }, { status: 500 });
  }
}
