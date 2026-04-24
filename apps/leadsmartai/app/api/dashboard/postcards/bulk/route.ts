import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createPostcardSend,
  type Channel,
} from "@/lib/postcards/service";
import type { PostcardTemplateKey } from "@/lib/postcards/templates";

export const runtime = "nodejs";
// Bulk sends: up to 50 contacts × up to 2 channels each. Each call
// serializes delivery, so a 50-contact batch with email+sms can run
// 3-10s. The default 10s timeout is tight; bump to 60s.
export const maxDuration = 60;

const MAX_BATCH = 50;
const ALLOWED_CHANNELS: Channel[] = ["email", "sms", "wechat"];

/**
 * POST /api/dashboard/postcards/bulk
 *   Body: {
 *     contactIds: string[];
 *     templateKey;
 *     personalMessage?;
 *     channels: Channel[];
 *   }
 *
 * Fans out to createPostcardSend once per contact. One contact
 * failing doesn't abort the others. Returns a per-contact result
 * array so the UI can surface "sent 18 of 20, 2 had no email".
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as {
      contactIds?: string[];
      templateKey?: string;
      personalMessage?: string | null;
      channels?: string[];
    };

    const contactIds = Array.isArray(body.contactIds)
      ? body.contactIds.filter((x): x is string => typeof x === "string").slice(0, MAX_BATCH)
      : [];
    if (!contactIds.length) {
      return NextResponse.json(
        { ok: false, error: "Pick at least one contact" },
        { status: 400 },
      );
    }
    if (!body.templateKey) {
      return NextResponse.json(
        { ok: false, error: "templateKey is required" },
        { status: 400 },
      );
    }
    const channels = (body.channels ?? []).filter((c): c is Channel =>
      ALLOWED_CHANNELS.includes(c as Channel),
    );
    if (!channels.length) {
      return NextResponse.json(
        { ok: false, error: "Pick at least one delivery channel" },
        { status: 400 },
      );
    }

    // Fetch the target contacts in one shot. Scoped by agent so a
    // malicious client can't send to someone else's contacts by
    // passing arbitrary ids.
    const { data: rows } = await supabaseAdmin
      .from("contacts")
      .select("id, name, first_name, last_name, email, phone")
      .eq("agent_id", agentId)
      .in("id", contactIds);
    const contacts = (rows ?? []) as Array<{
      id: string;
      name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
    }>;

    const results: Array<{
      contactId: string;
      recipientName: string;
      publicUrl: string | null;
      ok: boolean;
      deliveries?: Record<Channel, { ok: boolean; reason?: string }>;
      error?: string;
    }> = [];

    for (const c of contacts) {
      const displayName =
        `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
        c.name ||
        c.email ||
        "friend";
      try {
        const result = await createPostcardSend({
          agentId: String(agentId),
          contactId: c.id,
          templateKey: body.templateKey as PostcardTemplateKey,
          recipientName: displayName,
          recipientEmail: c.email,
          recipientPhone: c.phone,
          personalMessage: body.personalMessage ?? null,
          channels,
        });
        results.push({
          contactId: c.id,
          recipientName: displayName,
          publicUrl: result.publicUrl,
          ok: true,
          deliveries: result.deliveries,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        results.push({
          contactId: c.id,
          recipientName: displayName,
          publicUrl: null,
          ok: false,
          error: msg,
        });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: true,
      sent,
      failed: results.length - sent,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/postcards/bulk:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
