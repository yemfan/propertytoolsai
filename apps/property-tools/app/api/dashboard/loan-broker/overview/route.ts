import { NextResponse } from "next/server";
import { getLoanBrokerDashboardOverview, resolveLoanBrokerIdForUser } from "@/lib/dashboard/loanBroker";
import { getDashboardActor } from "@/lib/dashboard/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getDashboardActor(req);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "loan_broker" && actor.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;

    const brokerId = await resolveLoanBrokerIdForUser(actor.userId);
    const data = await getLoanBrokerDashboardOverview({ brokerId, start, end });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Loan broker dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load loan broker dashboard" },
      { status: 500 }
    );
  }
}
