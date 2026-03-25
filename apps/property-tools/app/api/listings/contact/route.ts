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
      actionType,
      notes,
    } = body;

    if (!name || !email || !listingId || !listingAddress || !actionType) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (actionType !== "ask_agent" && actionType !== "contact_agent") {
      return NextResponse.json(
        { success: false, error: "Invalid actionType" },
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
      actionType,
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
      actionType,
      notes,
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      assignedAgent: assignment,
    });
  } catch (error) {
    console.error("listing contact error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to submit inquiry" },
      { status: 500 }
    );
  }
}
