import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMarketplaceSessionId } from "@/lib/marketplaceSessionId";

export const runtime = "nodejs";

function pmt(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      homePrice?: number;
    };

    const address = String(body.address ?? "").trim();
    const homePrice = Number(body.homePrice ?? NaN);

    if (!address) {
      return NextResponse.json({ ok: false, error: "address is required" }, { status: 400 });
    }
    if (!Number.isFinite(homePrice) || homePrice <= 0) {
      return NextResponse.json({ ok: false, error: "homePrice must be a valid number" }, { status: 400 });
    }

    // Simple defaults (widget is intentionally lightweight).
    const downPayment = homePrice * 0.2;
    const principal = Math.max(0, homePrice - downPayment);
    const interestRate = 5; // %
    const years = 30;

    const monthlyPayment = pmt(principal, interestRate, years);

    // Marketplace tracking: log mortgage rate check.
    try {
      const user = await getUserFromRequest(req);
      const sessionId = getMarketplaceSessionId(req);
      await supabaseServer.rpc("log_tool_usage_and_update_opportunity", {
        p_user_id: user?.id ?? null,
        p_session_id: sessionId,
        p_tool_name: "mortgage",
        p_property_address: address,
        p_action: "submit",
        p_estimated_value: null,
      } as any);
    } catch {
      // best-effort
    }

    return NextResponse.json({
      ok: true,
      monthlyPayment,
      inputs: {
        address,
        homePrice,
        downPayment,
        interestRate,
        years,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

