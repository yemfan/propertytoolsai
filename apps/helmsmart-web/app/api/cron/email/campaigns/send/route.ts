import { createServiceClient } from "@/lib/supabase/server";
import { sendEmailCampaign } from "@/lib/integrations/email-campaign-sender";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = await createServiceClient();
  const now = new Date().toISOString();

  const { data: campaigns } = await db
    .from("email_campaigns")
    .select("id, organization_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .limit(50);

  if (!campaigns?.length) {
    return Response.json({ ok: true, message: "No campaigns to send", sent: 0 });
  }

  const results = await Promise.all(
    campaigns.map(async (c) => {
      const result = await sendEmailCampaign(c.organization_id, c.id);
      return { campaignId: c.id, ...result };
    })
  );

  return Response.json({
    ok: true,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
