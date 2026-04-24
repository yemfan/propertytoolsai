import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import {
  canAddContact,
  canAddLead,
  canCreateCma,
  canDownloadFullReport,
  canInviteTeam,
  canUseAiAction,
} from "@/lib/entitlements/accessResult";
import { incrementUsage } from "@/lib/entitlements/usage";

const consumeUsageSchema = z.object({
  action: z.enum([
    "create_cma",
    "add_lead",
    "add_contact",
    "download_full_report",
    "invite_team",
    "ai_action",
    /** @deprecated Use `download_full_report` */
    "download_report",
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
    const parsed = consumeUsageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const action =
      parsed.data.action === "download_report" ? "download_full_report" : parsed.data.action;

    switch (action) {
      case "create_cma": {
        const check = await canCreateCma(user.id);
        if (!check.allowed) {
          return NextResponse.json(
            { success: false, ok: false, error: "Limit reached", result: check },
            { status: 403 }
          );
        }
        await incrementUsage(user.id, "cma_reports_used");
        break;
      }

      case "add_lead": {
        const check = await canAddLead(user.id);
        if (!check.allowed) {
          return NextResponse.json(
            { success: false, ok: false, error: "Limit reached", result: check },
            { status: 403 }
          );
        }
        await incrementUsage(user.id, "leads_used");
        break;
      }

      case "add_contact": {
        const check = await canAddContact(user.id);
        if (!check.allowed) {
          return NextResponse.json(
            { success: false, ok: false, error: "Limit reached", result: check },
            { status: 403 }
          );
        }
        await incrementUsage(user.id, "contacts_used");
        break;
      }

      case "download_full_report": {
        const check = await canDownloadFullReport(user.id);
        if (!check.allowed) {
          return NextResponse.json(
            { success: false, ok: false, error: "Limit reached", result: check },
            { status: 403 }
          );
        }
        await incrementUsage(user.id, "report_downloads_used");
        break;
      }

      case "invite_team": {
        const check = await canInviteTeam(user.id);
        if (!check.allowed) {
          return NextResponse.json(
            { success: false, ok: false, error: "Limit reached", result: check },
            { status: 403 }
          );
        }
        // No `team_invites_used` column on `entitlement_usage_daily` — entitlement gate only.
        break;
      }

      case "ai_action": {
        const check = await canUseAiAction(user.id);
        if (!check.allowed) {
          return NextResponse.json(
            { success: false, ok: false, error: "Limit reached", result: check },
            { status: 403 }
          );
        }
        await incrementUsage(user.id, "ai_actions_used");
        break;
      }

      default:
        return NextResponse.json(
          { success: false, ok: false, error: "Unsupported action" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, ok: false, error: "Failed to consume usage" },
      { status: 500 }
    );
  }
}
