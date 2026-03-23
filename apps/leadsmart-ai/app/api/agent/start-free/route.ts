import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { PRODUCT_LEADSMART_AGENT } from "@/lib/entitlements/product";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Activates LeadSmart Agent Starter via `product_entitlements` (source: free_start).
 *
 * DB has a **partial** unique index on `(user_id, product) WHERE is_active`, so we cannot rely on
 * a plain `upsert(..., onConflict: user_id,product)`. Deactivate prior active rows, then insert.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);

    if (!user) {
      return NextResponse.json(
        { success: false, ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    const { error: deactErr } = await supabaseAdmin
      .from("product_entitlements")
      .update({ is_active: false, updated_at: now })
      .eq("user_id", user.id)
      .eq("product", PRODUCT_LEADSMART_AGENT);

    if (deactErr) throw deactErr;

    const { error } = await supabaseAdmin.from("product_entitlements").insert({
      user_id: user.id,
      product: PRODUCT_LEADSMART_AGENT,
      plan: "starter",
      is_active: true,
      cma_reports_per_day: 2,
      max_leads: 5,
      max_contacts: 50,
      alerts_level: "basic",
      reports_download_level: "limited",
      team_access: false,
      source: "free_start",
      starts_at: now,
      updated_at: now,
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      ok: true,
      redirectTo: "/agent/dashboard",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, ok: false, error: "Failed to start free agent access" },
      { status: 500 }
    );
  }
}
