import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkTriggers } from "@/lib/triggerEngine";
import {
  notifyAgent,
  recordOutreachSent,
  sendEmailToUser,
  sendSMS,
  type OutreachLead,
  type OutreachUser,
} from "@/lib/outreach";
import type { UserProfile } from "@/lib/userProfile";

export const runtime = "nodejs";

const COOLDOWN_HOURS = Number(process.env.OUTREACH_COOLDOWN_HOURS ?? "48");

type Body = {
  profile?: UserProfile;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  leadId?: string;
  /** Skip sending (prediction only) */
  dryRun?: boolean;
};

async function hadRecentOutreach(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const since = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseServer
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "outreach_sent")
    .gte("created_at", since);
  if (error) {
    console.warn("hadRecentOutreach", error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * POST /api/outreach/evaluate — conversion score + optional auto SMS/email when score > 70.
 * Set OUTREACH_AUTO_ENABLED=true to send; otherwise returns prediction only.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const profile = body.profile;
    if (!profile || typeof profile !== "object") {
      return NextResponse.json({ ok: false, error: "profile is required." }, { status: 400 });
    }

    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;

    const decision = checkTriggers({ profile });
    const autoEnabled =
      process.env.OUTREACH_AUTO_ENABLED === "1" || process.env.OUTREACH_AUTO_ENABLED === "true";
    const dryRun = Boolean(body.dryRun) || !autoEnabled;

    if (!decision.shouldOutreach) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: decision.reason,
        prediction: decision.prediction,
      });
    }

    if (await hadRecentOutreach(userId)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "cooldown",
        prediction: decision.prediction,
      });
    }

    const contact = body.contact ?? {};
    const outreachUser: OutreachUser = {
      name: contact.name ?? user?.user_metadata?.full_name ?? user?.email?.split("@")[0],
      email: contact.email ?? user?.email ?? null,
      phone: contact.phone,
      leadId: body.leadId ?? null,
    };

    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://propertytoolsai.com";
    const first = outreachUser.name?.trim() || "there";
    const smsBody = `${first}, thanks for using PropertyTools AI — you’re exploring several investment tools. Want a quick human review? Reply YES or visit ${site}/contact`;
    const emailSubject = "Your next step on PropertyTools AI";
    const emailText = `Hi ${first},

We noticed strong engagement with our calculators and AI tools. If you’d like help interpreting results or comparing options, reply to this email or visit:
${site}/contact

— PropertyTools AI`;

    const channels: ("sms" | "email")[] = [];

    if (!dryRun) {
      if (outreachUser.phone) {
        const sms = await sendSMS(outreachUser, smsBody);
        if (sms.ok) channels.push("sms");
      }
      if (outreachUser.email && !channels.includes("sms")) {
        const em = await sendEmailToUser(outreachUser, emailSubject, emailText);
        if (em.ok) channels.push("email");
      }

      if (body.leadId) {
        const lead: OutreachLead = {
          id: String(body.leadId),
          name: outreachUser.name,
          email: outreachUser.email,
          phone: outreachUser.phone,
          property_address: null,
          agent_id: null,
        };
        await notifyAgent(lead, decision.reason);
      }

      if (channels.length > 0) {
        await recordOutreachSent({
          userId,
          channels,
          leadId: body.leadId ?? null,
          score: decision.prediction.score,
          trigger: decision.trigger,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      skipped: dryRun || channels.length === 0,
      dryRun,
      prediction: decision.prediction,
      trigger: decision.trigger,
      reason: decision.reason,
      channelsSent: dryRun ? [] : channels,
    });
  } catch (e: any) {
    console.error("POST /api/outreach/evaluate", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
