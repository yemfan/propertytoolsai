import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import {
  canAddContact,
  canAddLead,
  canCreateCma,
  canDownloadFullReport,
  canInviteTeam,
} from "@/lib/entitlements/accessResult";

const checkLimitSchema = z.object({
  action: z.enum([
    "create_cma",
    "add_lead",
    "add_contact",
    "download_full_report",
    "invite_team",
  ]),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);

    if (!user) {
      return NextResponse.json(
        { success: false, ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = checkLimitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let result;

    switch (parsed.data.action) {
      case "create_cma":
        result = await canCreateCma(user.id);
        break;
      case "add_lead":
        result = await canAddLead(user.id);
        break;
      case "add_contact":
        result = await canAddContact(user.id);
        break;
      case "download_full_report":
        result = await canDownloadFullReport(user.id);
        break;
      case "invite_team":
        result = await canInviteTeam(user.id);
        break;
      default:
        return NextResponse.json(
          { success: false, ok: false, error: "Unsupported action" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      ok: true,
      result,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, ok: false, error: "Failed to check limit" },
      { status: 500 }
    );
  }
}
