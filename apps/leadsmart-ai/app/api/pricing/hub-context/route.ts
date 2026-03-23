import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import {
  buildPricingHubContext,
  emptyPricingHubContext,
} from "@/lib/pricing/pricingHubContext";

/**
 * JSON snapshot for pricing hub UIs (client fetch or tooling).
 * Matches `PricingHubContext` from `@/lib/pricing/pricingHubContext`.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);

    if (!user) {
      return NextResponse.json({
        success: true,
        context: { ...emptyPricingHubContext },
      });
    }

    const context = await buildPricingHubContext(user);

    return NextResponse.json({
      success: true,
      context,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to load pricing hub context" },
      { status: 500 }
    );
  }
}
