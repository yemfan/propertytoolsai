import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { runContactIngestion } from "@/lib/contact-intake/ingestionPipeline";
import {
  fetchLeadByLeadgenId,
  mapLeadFieldsToContactInput,
} from "@/lib/leads-gen/meta-ads";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Meta retries failed webhooks for up to 36 hours; a slow per-event
// processing path is fine. Stay well under platform timeout though.
export const maxDuration = 60;

const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

/**
 * Meta webhook endpoint for Leads (`leadgen` events from Lead Ads).
 *
 * Two flows, distinguished by HTTP method:
 *
 *   GET  — verification challenge. Meta sends:
 *            ?hub.mode=subscribe&hub.verify_token=<our token>&hub.challenge=<echo>
 *          We echo `hub.challenge` back ONLY when the verify token matches
 *          `META_WEBHOOK_VERIFY_TOKEN`. Meta uses this when we first
 *          subscribe + periodically to confirm the URL is alive.
 *
 *   POST — leadgen events. Body shape:
 *            {
 *              object: "page",
 *              entry: [
 *                { id: "<page-id>", time: <ts>, changes: [
 *                    { field: "leadgen", value: {
 *                      ad_id, adgroup_id, form_id, leadgen_id, page_id,
 *                      created_time
 *                    }}
 *                ]}
 *              ]
 *            }
 *
 *          For each leadgen entry:
 *            1. Look up the social_account by fb_page_id → get the
 *               Page access token (which has leads_retrieval scope)
 *            2. GET /{leadgen-id} to fetch the field_data
 *            3. Look up the campaign by form_id (when known) to
 *               attribute the lead + bump the campaign counter
 *            4. Map field_data onto our CRM contact shape
 *            5. runContactIngestion (same pipeline CSV / AI extract use)
 *               with intake_channel='manual_batch' + source='Meta Lead Ad'
 *            6. Log a meta_webhook_events row regardless of success
 *
 *   Always 200 the POST — Meta retries on non-200, and a transient
 *   downstream failure on our side shouldn't cause Meta to spam us
 *   with retries for 36h. The error is captured in
 *   meta_webhook_events.status='failed' for us to triage later.
 */

// ── GET: verification challenge ───────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Don't reveal that the verify token exists or what's required —
  // just return the challenge on success, 403 on anything else.
  if (
    mode === "subscribe" &&
    token &&
    META_WEBHOOK_VERIFY_TOKEN &&
    crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(META_WEBHOOK_VERIFY_TOKEN),
    ) &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

// ── POST: leadgen events ─────────────────────────────────────────────

type LeadgenChange = {
  field?: string;
  value?: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    ad_id?: string;
    adgroup_id?: string;
    created_time?: number | string;
  };
};

type WebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: LeadgenChange[];
  }>;
};

export async function POST(req: Request) {
  if (!META_APP_SECRET) {
    console.error("[meta/webhooks/leads] META_APP_SECRET not configured");
    // 200 anyway — Meta retries on non-200, and a misconfigured app
    // secret on our side isn't fixable by Meta retrying. We capture
    // the issue server-side and move on.
    return NextResponse.json({ received: true, note: "secret not configured" });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ received: true });
  }

  // 1. Validate the signature. Meta sends X-Hub-Signature-256 as
  //    `sha256=<hex>`. Constant-time compare against our HMAC.
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  if (!verifySignature(rawBody, sigHeader)) {
    console.warn("[meta/webhooks/leads] signature verification failed");
    // 403 here — invalid signatures are an attack signal, not a Meta-
    // retry case. Meta will keep retrying with the same (correct)
    // signature, so this only fires on bad actors.
    return new Response("Forbidden", { status: 403 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true, note: "malformed body" });
  }

  // 2. Walk entries × changes and process each leadgen event.
  //    Independent — one failure doesn't stop the rest.
  const entries = body.entry ?? [];
  for (const entry of entries) {
    const pageId = entry.id ?? null;
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen" || !change.value?.leadgen_id) continue;
      // Fire-and-forget per-lead processing. We await sequentially
      // so a slow Meta API call doesn't multiply by N — Meta's
      // webhook timeout is 20s, sequential is safer than parallel
      // for the typical small-batch payload.
      try {
        await processLeadgen({
          leadgenId: change.value.leadgen_id,
          pageId: pageId ?? change.value.page_id ?? null,
          formId: change.value.form_id ?? null,
          adId: change.value.ad_id ?? null,
          adgroupId: change.value.adgroup_id ?? null,
          rawPayload: change.value,
        });
      } catch (e) {
        // Last-resort catch — processLeadgen catches its own errors
        // and logs to meta_webhook_events. This catches the case
        // where the audit-row insert itself failed.
        console.error("[meta/webhooks/leads] processLeadgen threw:", e);
      }
    }
  }

  return NextResponse.json({ received: true });
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Validate the X-Hub-Signature-256 header against our app secret.
 * Header format: `sha256=<hex>`.
 */
function verifySignature(rawBody: string, sigHeader: string): boolean {
  if (!sigHeader.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", META_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  const provided = sigHeader.slice("sha256=".length);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(provided, "hex"),
  );
}

/**
 * Process a single leadgen event end-to-end.
 *
 * Logs to meta_webhook_events as it goes — the row starts as
 * `received`, transitions to `processed` on success, `no_match`
 * if we can't find the connection, or `failed` if something
 * went wrong downstream.
 */
async function processLeadgen(params: {
  leadgenId: string;
  pageId: string | null;
  formId: string | null;
  adId: string | null;
  adgroupId: string | null;
  rawPayload: unknown;
}): Promise<void> {
  const { leadgenId, pageId, formId, adId, adgroupId, rawPayload } = params;

  // Audit row first so we have a record even if everything below fails.
  const { data: auditRow } = await supabaseAdmin
    .from("meta_webhook_events")
    .insert({
      event_type: "leadgen",
      meta_page_id: pageId,
      meta_form_id: formId,
      meta_leadgen_id: leadgenId,
      meta_ad_id: adId,
      meta_adgroup_id: adgroupId,
      raw_payload: rawPayload as Record<string, unknown>,
      status: "received",
    } as Record<string, unknown>)
    .select("id")
    .single();
  const auditId = (auditRow as { id?: string } | null)?.id ?? null;

  async function markAudit(
    status: "processed" | "no_match" | "failed",
    extras: Partial<{
      error_message: string;
      campaign_id: string | null;
      contact_id: string | null;
    }> = {},
  ) {
    if (!auditId) return;
    try {
      await supabaseAdmin
        .from("meta_webhook_events")
        .update({
          status,
          processed_at: new Date().toISOString(),
          ...extras,
        } as Record<string, unknown>)
        .eq("id", auditId);
    } catch (e) {
      // best-effort
      console.warn("[meta/webhooks/leads] audit update failed:", e);
    }
  }

  if (!pageId) {
    await markAudit("no_match", { error_message: "Missing page_id in payload" });
    return;
  }

  try {
    // Find the social_accounts row for this Page. The Page token
    // we stored at OAuth time is what lets us fetch the lead.
    const { data: connRow, error: connErr } = await supabaseAdmin
      .from("social_accounts")
      .select("id, agent_id, page_access_token_enc, status")
      .eq("platform", "meta")
      .eq("fb_page_id", pageId)
      .maybeSingle();
    if (connErr) throw connErr;
    if (!connRow) {
      // Meta sent us a leadgen for a Page no agent has connected.
      // Could be a stale subscription from a since-disconnected
      // agent. Skip cleanly — no error.
      await markAudit("no_match", { error_message: "No connection for this page" });
      return;
    }

    const conn = connRow as {
      id: string;
      agent_id: string;
      page_access_token_enc: string | null;
      status: string;
    };

    if (conn.status !== "connected" || !conn.page_access_token_enc) {
      await markAudit("no_match", { error_message: `Connection status: ${conn.status}` });
      return;
    }

    let pageToken: string;
    try {
      pageToken = decryptToken(conn.page_access_token_enc);
    } catch (e) {
      await markAudit("failed", {
        error_message: `Token decryption failed: ${e instanceof Error ? e.message : "unknown"}`,
      });
      return;
    }

    // Optional: look up campaign by form_id for attribution.
    let campaignId: string | null = null;
    let campaignSource = "Meta Lead Ad";
    if (formId) {
      const { data: campRow } = await supabaseAdmin
        .from("lead_ad_campaigns")
        .select("id, name")
        .eq("meta_form_id", formId)
        .eq("agent_id", conn.agent_id)
        .maybeSingle();
      if (campRow) {
        campaignId = (campRow as { id: string }).id;
        const name = (campRow as { name?: string }).name;
        if (name) campaignSource = `Meta Lead Ad — ${name}`;
      }
    }

    // Fetch the full lead from Meta.
    const lead = await fetchLeadByLeadgenId({ leadgenId, pageAccessToken: pageToken });
    const fields = mapLeadFieldsToContactInput(lead.fieldData);
    if (!fields.name && !fields.email && !fields.phone) {
      // Lead form had no usable contact info — Meta does allow this
      // in some custom configurations.
      await markAudit("no_match", { error_message: "Lead has no usable contact fields" });
      return;
    }

    // Push into the shared ingestion pipeline so the lead gets the
    // same dedup / normalization / enrichment / activity-log treatment
    // as any other source.
    const result = await runContactIngestion({
      agentId: conn.agent_id,
      planType: "premium", // attribution-only — plan gating happens at create-campaign time
      fields: {
        ...fields,
        source: campaignSource,
      },
      intakeChannel: "manual_batch",
      duplicateStrategy: "merge",
      skipEnrichment: false,
    });

    const contactId =
      result.action === "skipped" ? result.duplicateLeadId : result.leadId;

    // Bump the campaign counter so the management dashboard's
    // "leads received" tile updates without a periodic query.
    if (campaignId) {
      try {
        const nowIso = new Date().toISOString();
        await supabaseAdmin.rpc("increment_lead_ad_campaign_leads", {
          p_campaign_id: campaignId,
          p_last_lead_at: nowIso,
        } as Record<string, unknown>);
      } catch {
        // RPC doesn't exist yet (Phase 2B.3 ships it). Fall back
        // to a plain update so we don't lose the counter.
        try {
          const { data: current } = await supabaseAdmin
            .from("lead_ad_campaigns")
            .select("leads_received_count")
            .eq("id", campaignId)
            .maybeSingle();
          const next =
            ((current as { leads_received_count?: number } | null)?.leads_received_count ?? 0) + 1;
          await supabaseAdmin
            .from("lead_ad_campaigns")
            .update({
              leads_received_count: next,
              last_lead_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq("id", campaignId);
        } catch {
          // best-effort
        }
      }
    }

    await markAudit("processed", {
      campaign_id: campaignId,
      contact_id: contactId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    console.error("[meta/webhooks/leads] processLeadgen failed:", msg);
    await markAudit("failed", { error_message: msg.slice(0, 1000) });
  }
}
