import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { loadAgentSignatureProfile } from "@/lib/signatures/loadProfile";
import {
  appendHtmlSignature,
  appendTextSignature,
  composeSignature,
} from "@/lib/signatures/compose";
import type {
  AgentPropertyRecommendation,
  RecommendationListing,
} from "./types";

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://www.propertytoolsai.com";

function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

function mapRow(row: Record<string, unknown>): AgentPropertyRecommendation {
  return {
    id: String(row.id),
    agentId: (row.agent_id as number | string) ?? "",
    contactId: String(row.contact_id),
    subject: (row.subject as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    listings: Array.isArray(row.listings)
      ? (row.listings as RecommendationListing[])
      : [],
    sentAt: (row.sent_at as string | null) ?? null,
    openedAt: (row.opened_at as string | null) ?? null,
    firstClickedAt: (row.first_clicked_at as string | null) ?? null,
    clickCount: Number(row.click_count ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function assertContactBelongsToAgent(
  agentId: string | number,
  contactId: string,
): Promise<{ email: string | null; firstName: string | null; doNotContactEmail: boolean }> {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("id,email,first_name,do_not_contact_email")
    .eq("id", contactId)
    .eq("agent_id", agentId as never)
    .maybeSingle();
  if (!data) throw new Error("Contact does not belong to this agent");
  const row = data as {
    email: string | null;
    first_name: string | null;
    do_not_contact_email: boolean;
  };
  return {
    email: row.email,
    firstName: row.first_name,
    doNotContactEmail: !!row.do_not_contact_email,
  };
}

export type CreateAndSendInput = {
  contactId: string;
  subject: string;
  note: string;
  listings: RecommendationListing[];
  /** Per-send override — set true to skip appending the agent's signature. */
  suppressSignature?: boolean;
};

/**
 * Compose + send a curated listing email from an agent to one of their
 * contacts. Writes an agent_property_recommendations row, sends via
 * Resend, updates sent_at on success.
 */
export async function createAndSendRecommendation(
  agentId: string | number,
  input: CreateAndSendInput,
): Promise<AgentPropertyRecommendation> {
  if (!input.contactId) throw new Error("contactId required");
  if (input.listings.length === 0) throw new Error("At least one listing required");
  if (input.listings.length > 20) throw new Error("Max 20 listings per send");

  const contact = await assertContactBelongsToAgent(agentId, input.contactId);
  if (!contact.email) throw new Error("Contact has no email on file");
  if (contact.doNotContactEmail) throw new Error("Contact opted out of email");

  const subject = input.subject.trim().slice(0, 200) || "Homes I picked for you";
  const note = input.note.trim().slice(0, 2000);

  // Insert the record first — we want a stable id for click/open tracking
  // URLs in the email body.
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("agent_property_recommendations")
    .insert({
      agent_id: agentId as never,
      contact_id: input.contactId,
      subject,
      note,
      listings: input.listings as never,
    } as never)
    .select("*")
    .single();
  if (insErr) throw insErr;
  const rec = mapRow(inserted as Record<string, unknown>);

  // Compose email
  const greeting = contact.firstName ? `Hi ${contact.firstName},` : "Hi there,";
  const { text, html } = renderEmail({
    greeting,
    subject,
    note,
    listings: input.listings,
    recommendationId: rec.id,
  });

  // Append agent signature (or skip per the suppressSignature override).
  let finalText = text;
  let finalHtml = html;
  const skip = input.suppressSignature === true;
  if (!skip) {
    const sigProfile = await loadAgentSignatureProfile(agentId);
    if (sigProfile) {
      const sig = composeSignature(sigProfile);
      finalText = appendTextSignature(text, sig);
      finalHtml = appendHtmlSignature(html, sig);
    }
  }

  try {
    await sendEmail({ to: contact.email, subject, text: finalText, html: finalHtml });
  } catch (e) {
    console.error("[recommendations] send failed", e);
    throw e;
  }

  // Mark sent
  await supabaseAdmin
    .from("agent_property_recommendations")
    .update({ sent_at: new Date().toISOString() } as never)
    .eq("id", rec.id);

  // Log the recommendation_sent event so the scoring cron sees the
  // agent activity on this contact (useful for follow-up signals).
  await supabaseAdmin.from("contact_events").insert({
    contact_id: input.contactId,
    agent_id: agentId as never,
    event_type: "property_share",
    source: "agent_send",
    payload: {
      recommendation_id: rec.id,
      listing_count: input.listings.length,
    } as never,
  } as never);

  return { ...rec, sentAt: new Date().toISOString() };
}

export async function listRecommendationsForContact(
  agentId: string | number,
  contactId: string,
): Promise<AgentPropertyRecommendation[]> {
  const { data, error } = await supabaseAdmin
    .from("agent_property_recommendations")
    .select("*")
    .eq("agent_id", agentId as never)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (
      (error as { code?: string }).code === "42P01" ||
      /does not exist|schema cache/i.test((error as { message?: string }).message ?? "")
    ) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

// =============================================================================
// Email template
// =============================================================================

function clickUrl(recommendationId: string, listing: RecommendationListing): string {
  const u = new URL(`${PUBLIC_BASE_URL.replace(/\/$/, "")}/api/alerts/click`);
  u.searchParams.set("r", recommendationId);
  u.searchParams.set("l", listing.propertyId);
  u.searchParams.set("to", `/listing/${encodeURIComponent(listing.propertyId)}`);
  return u.toString();
}

function openPixelUrl(recommendationId: string): string {
  const u = new URL(`${PUBLIC_BASE_URL.replace(/\/$/, "")}/api/alerts/opened`);
  u.searchParams.set("r", recommendationId);
  return u.toString();
}

function renderEmail(args: {
  greeting: string;
  subject: string;
  note: string;
  listings: RecommendationListing[];
  recommendationId: string;
}): { text: string; html: string } {
  const { greeting, subject, note, listings, recommendationId } = args;

  const textLines: string[] = [];
  textLines.push(greeting);
  textLines.push("");
  if (note) {
    textLines.push(note);
    textLines.push("");
  }
  textLines.push(`I picked ${listings.length === 1 ? "this home" : `these ${listings.length} homes`} for you:`);
  textLines.push("");
  for (const l of listings) {
    const bedsBaths = [
      l.beds ? `${l.beds} bd` : null,
      l.baths ? `${l.baths} ba` : null,
      l.sqft ? `${l.sqft.toLocaleString()} sqft` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    textLines.push(`- ${money(l.price)} — ${l.address ?? l.propertyId}`);
    if (bedsBaths) textLines.push(`  ${bedsBaths}`);
    textLines.push(`  ${clickUrl(recommendationId, l)}`);
    textLines.push("");
  }
  const text = textLines.join("\n");

  const cards = listings
    .map((l) => {
      const bedsBaths = [
        l.beds ? `${l.beds} bd` : null,
        l.baths ? `${l.baths} ba` : null,
        l.sqft ? `${l.sqft.toLocaleString()} sqft` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const url = clickUrl(recommendationId, l);
      const photo = l.photoUrl
        ? `<td width="120" style="padding-right:14px;vertical-align:top;"><a href="${url}" style="text-decoration:none;"><img src="${l.photoUrl}" width="120" height="90" alt="" style="display:block;border-radius:6px;object-fit:cover;"/></a></td>`
        : "";
      return `
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    ${photo}
    <td style="vertical-align:top;">
      <div style="font-size:18px;font-weight:600;color:#0f172a;">
        <a href="${url}" style="color:#0f172a;text-decoration:none;">${money(l.price)} — ${l.address ?? ""}</a>
      </div>
      ${bedsBaths ? `<div style="font-size:13px;color:#475569;margin-top:4px;">${bedsBaths}</div>` : ""}
      <div style="margin-top:8px;"><a href="${url}" style="font-size:12px;color:#0066b3;text-decoration:none;">View details &rarr;</a></div>
    </td>
  </tr></table>
</td></tr>`;
    })
    .join("");

  const noteBlock = note
    ? `<div style="margin-top:12px;font-size:14px;color:#334155;line-height:1.5;white-space:pre-wrap;">${escapeHtml(note)}</div>`
    : "";

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellspacing="0" cellpadding="0" border="0" style="background:white;border-radius:12px;padding:24px;max-width:600px;">
        <tr><td>
          <div style="font-size:14px;color:#64748b;">${escapeHtml(greeting)}</div>
          <h1 style="font-size:20px;color:#0f172a;margin:12px 0 4px;">${escapeHtml(subject)}</h1>
          ${noteBlock}
          <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">${cards}</table>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <img src="${openPixelUrl(recommendationId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;"/>
</body></html>`.trim();

  return { text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
