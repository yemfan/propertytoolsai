import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPropertyData } from "@/lib/getPropertyData";
import { getPropertyByAddress } from "@/lib/propertyService";
import { generateOpenHouseReportData } from "@/lib/openHouseReport";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      // Optional: attach report to an existing lead later.
      contact_id?: string | null;
      // Optional: allow refresh to force a new ingestion/snapshot.
      forceRefresh?: boolean;
    };

    const address = String(body.address ?? "").trim();
    const lead_id = body.contact_id ?? null;
    const forceRefresh = Boolean(body.forceRefresh);

    if (!address) {
      return NextResponse.json(
        { success: false, message: "address is required." },
        { status: 400 }
      );
    }

    // Ensure we have up-to-date warehouse rows + snapshots.
    await getPropertyData(address, forceRefresh);

    const subject = await getPropertyByAddress(address);
    if (!subject) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Property not found in warehouse after ingestion. Try again or import MLS.",
        },
        { status: 404 }
      );
    }

    // Reuse the same report schema as the Open House flow so `/report/[id]` renders correctly.
    const reportData = await generateOpenHouseReportData({
      propertyId: subject.id,
      address: subject.address,
    });

    const { data, error } = await supabaseServer
      .from("reports")
      .insert({
        property_id: subject.id,
        contact_id: null,
        report_data: reportData,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json(
        { success: false, message: error?.message || "Failed to save report." },
        { status: 500 }
      );
    }

    const reportId = String(data.id);

    // Best-effort: attach the report back onto the lead for CRM context.
    if (lead_id) {
      try {
        const { error: leadUpdateErr } = await supabaseServer
          .from("contacts")
          .update({ report_id: reportId })
          .eq("id", lead_id);

        if (leadUpdateErr) {
          console.error("create-property-report: lead update failed", leadUpdateErr);
        }
      } catch (e) {
        console.error("create-property-report: lead update threw", e);
      }
    }

    return NextResponse.json({
      success: true,
      reportId,
      reportLink: `/report/${encodeURIComponent(reportId)}`,
    });
  } catch (e: any) {
    console.error("create-property-report error", e);
    return NextResponse.json(
      {
        success: false,
        message: e?.message ?? "Server error saving report.",
      },
      { status: 500 }
    );
  }
}

