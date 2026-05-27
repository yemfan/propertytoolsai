"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { runAutomations } from "@/lib/automation-engine";

const resend = new Resend(process.env.RESEND_API_KEY);

type RecipientFilter = "all" | "active" | "leads" | "prospects" | "inactive";

// ─── Create campaign ──────────────────────────────────────────────────────────

export async function createCampaign(data: {
  name: string;
  subject: string;
  body: string;
  recipient_filter: RecipientFilter;
}): Promise<string> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      organization_id: orgId,
      name: data.name,
      subject: data.subject,
      body: data.body,
      recipient_filter: data.recipient_filter,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !campaign) throw new Error(error?.message ?? "Failed to create campaign");

  revalidatePath("/marketing");
  return campaign.id;
}

// ─── Send campaign ────────────────────────────────────────────────────────────

export async function sendCampaign(campaignId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();

  // Load campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .single();

  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("Campaign already sent");

  // Resolve recipients
  let clientQuery = supabase
    .from("clients")
    .select("id, first_name, last_name, email")
    .eq("organization_id", orgId)
    .not("email", "is", null)
    .neq("email", "");

  if (campaign.recipient_filter !== "all") {
    const statusMap: Record<string, string> = {
      active: "active",
      leads: "lead",
      prospects: "prospect",
      inactive: "inactive",
    };
    const status = statusMap[campaign.recipient_filter];
    if (status) clientQuery = clientQuery.eq("status", status);
  }

  const { data: clients } = await clientQuery;
  const recipients = (clients ?? []).filter((c) => c.email);

  if (!recipients.length) {
    throw new Error("No recipients found for this segment. Add email addresses to clients first.");
  }

  // Mark as sending
  await supabase
    .from("campaigns")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@smbai.app";
  const orgNameRes = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  const orgName = orgNameRes.data?.name ?? "SMB AI";

  // HTML template
  function buildHtml(clientName: string): string {
    const bodyHtml = campaign.body
      .split("\n")
      .map((line: string) =>
        line.trim()
          ? `<p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6">${line}</p>`
          : "<br>"
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="background:#4f46e5;padding:20px 40px">
          <span style="font-size:16px;font-weight:700;color:#fff">${orgName}</span>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <p style="margin:0 0 20px;font-size:15px;color:#334155">Hi ${clientName},</p>
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#94a3b8">Sent by ${orgName} · Powered by SMB AI</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  // Send in batches of 50 (Resend rate limit)
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += 50) {
    const batch = recipients.slice(i, i + 50);
    const emails = batch.map((c) => ({
      from: `${orgName} <${fromEmail}>`,
      to: c.email as string,
      subject: campaign.subject,
      html: buildHtml(
        [c.first_name, c.last_name].filter(Boolean).join(" ") || "there"
      ),
      text: `Hi ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "there"},\n\n${campaign.body}\n\n— ${orgName}`,
    }));

    try {
      await resend.batch.send(emails);
      sent += batch.length;
    } catch {
      failed += batch.length;
    }
  }

  // Mark sent (even if some failed — log counts)
  await supabase
    .from("campaigns")
    .update({
      status: failed === recipients.length ? "failed" : "sent",
      recipient_count: sent,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  revalidatePath("/marketing");
  revalidatePath(`/marketing/${campaignId}`);

  // Run automation rules for campaign_sent
  await runAutomations("campaign_sent", {
    orgId,
    campaignId,
    campaignName: campaign.name,
  });
}

// ─── Delete draft ─────────────────────────────────────────────────────────────

export async function deleteCampaign(campaignId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .eq("status", "draft"); // Only drafts can be deleted

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}
