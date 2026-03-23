import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { hasAgentWorkspaceAccess } from "@/lib/entitlements/agentAccess";
import { getAgentEntitlement } from "@/lib/entitlements/getEntitlements";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);

    if (!user) {
      return NextResponse.json(
        { success: false, ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = supabaseServerClient();
    const entitlement = await getAgentEntitlement(supabase, user.id);
    /** Align with `hasAgentWorkspaceAccess` (e.g. platform admin without a product row). */
    const hasAccess = await hasAgentWorkspaceAccess(supabase, user.id, user.role);

    return NextResponse.json({
      success: true,
      ok: true,
      hasAccess,
      entitlement,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, ok: false, error: "Failed to check agent access" },
      { status: 500 }
    );
  }
}
