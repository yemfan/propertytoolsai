import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentSignatureProfile } from "./compose";

/**
 * Server-side helper: hydrate an AgentSignatureProfile for a given
 * agent id. Joins the `agents` branding columns with `user_profiles`
 * (for full_name / email / phone when the agent row is missing them).
 *
 * Used by:
 *   - /api/dashboard/agent/signature/preview (preview endpoint)
 *   - appendSignatureToEmail() in every send path
 *
 * Returns null when the agent doesn't exist — caller decides whether
 * to treat that as "skip signature" or "error".
 */
export async function loadAgentSignatureProfile(
  agentId: string | number,
): Promise<AgentSignatureProfile | null> {
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select(
      "id, auth_user_id, brand_name, signature_html, logo_url, agent_photo_url, brokerage, phone",
    )
    .eq("id", agentId as never)
    .maybeSingle();
  if (error || !agent) return null;

  const row = agent as {
    auth_user_id: string | null;
    brand_name: string | null;
    signature_html: string | null;
    logo_url: string | null;
    agent_photo_url: string | null;
    brokerage: string | null;
    phone: string | null;
  };

  // Pull name/email/phone + avatar from user_profiles. The profile
  // page's "Change photo" button is now the single source of truth for
  // the agent headshot (used here + in the TopBar avatar). The old
  // duplicate upload in the Branding panel was retired; we fall back
  // to agents.agent_photo_url so agents who uploaded before the
  // unification keep their signature photo until a backfill copies
  // those URLs into avatar_url.
  let fullName: string | null = null;
  let email: string | null = null;
  let phone: string | null = row.phone;
  let profileAvatarUrl: string | null = null;
  if (row.auth_user_id) {
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("full_name, email, phone, avatar_url")
      .eq("user_id", row.auth_user_id)
      .maybeSingle();
    if (profile) {
      const p = profile as {
        full_name?: string;
        email?: string;
        phone?: string;
        avatar_url?: string;
      };
      fullName = p.full_name ?? null;
      email = p.email ?? null;
      phone = phone ?? p.phone ?? null;
      profileAvatarUrl = p.avatar_url ?? null;
    }
  }

  // Split full_name into first/last for the composer (which prefers split).
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (fullName) {
    const trimmed = fullName.trim();
    const idx = trimmed.search(/\s/);
    if (idx < 0) {
      firstName = trimmed;
    } else {
      firstName = trimmed.slice(0, idx);
      lastName = trimmed.slice(idx + 1).trim() || null;
    }
  }

  return {
    firstName,
    lastName,
    fullName,
    email,
    phone,
    brandName: row.brand_name,
    brokerage: row.brokerage,
    signatureHtml: row.signature_html,
    // Prefer user_profiles.avatar_url (current source of truth); fall
    // back to legacy agents.agent_photo_url for grandfathered rows.
    agentPhotoUrl: profileAvatarUrl ?? row.agent_photo_url,
    logoUrl: row.logo_url,
  };
}
