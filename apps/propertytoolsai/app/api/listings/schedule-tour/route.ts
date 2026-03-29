import { NextResponse } from "next/server";
import { connectListingLeadToAutomation } from "@/lib/listings/automation";
import { autoAssignListingLead, createListingLead } from "@/lib/listings/lead-routing";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      listingId,
      listingAddress,
      city,
      zip,
      price,
      requestedTime,
      notes,
    } = body;

    if (!name || !email || !listingId || !listingAddress || !requestedTime) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const lead = await createListingLead({
      name,
      email,
      phone,
      listingId,
      listingAddress,
      city,
      zip,
      price,
      actionType: "schedule_tour",
      requestedTime,
      notes,
    });

    const assignment = await autoAssignListingLead(lead.id, zip, city);

    await connectListingLeadToAutomation({
      leadId: lead.id,
      assignedAgent: assignment,
      customerName: name,
      customerEmail: email,
      customerPhone: phone || null,
      listingId,
      listingAddress,
      actionType: "schedule_tour",
      requestedTime,
      notes,
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      assignedAgent: assignment,
    });
  } catch (error) {
    console.error("schedule tour error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to schedule tour request",
      },
      { status: 500 }
    );
  }
}
