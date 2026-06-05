import { createServiceClient } from "@/lib/supabase/server";
import { sendSMSCampaign } from "@/lib/integrations/sms-campaign-sender";

/**
 * Cron job to send scheduled SMS campaigns
 * Runs every 15 minutes
 */
export async function GET(request: Request) {
  // Verify cron auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = await createServiceClient();

  try {
    // Find campaigns that are scheduled for "now" or earlier
    const now = new Date().toISOString();
    const { data: campaigns } = await db
      .from("sms_campaigns")
      .select("id, organization_id")
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .limit(100);

    if (!campaigns || campaigns.length === 0) {
      return Response.json({
        ok: true,
        message: "No campaigns to send",
        sent: [],
      });
    }

    // Send each campaign
    const results = await Promise.all(
      campaigns.map(async (campaign) => {
        const result = await sendSMSCampaign(campaign.organization_id, campaign.id);
        return {
          campaignId: campaign.id,
          orgId: campaign.organization_id,
          ...result,
        };
      })
    );

    // Count successes and failures
    const successful = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    console.log(
      `[sms-campaigns-send] Processed ${campaigns.length} campaigns: ${successful.length} sent, ${failed.length} failed`
    );

    return Response.json({
      ok: true,
      message: `Processed ${campaigns.length} campaigns`,
      sent: successful.length,
      failed: failed.length,
      campaigns: results,
    });
  } catch (error) {
    console.error("[sms-campaigns-send] error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
