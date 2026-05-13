import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

import ConnectClient from "./ConnectClient";

export const metadata: Metadata = {
  title: "Connect Platforms | LeadSmart AI",
  description:
    "Connect your Facebook Pages, Instagram Business accounts, and LinkedIn profile so Generate Leads can publish directly.",
  robots: { index: false },
};

type PageProps = {
  searchParams: Promise<{
    status?: string;
    reason?: string;
    count?: string;
    /** Which network the flash refers to (set by the callback). */
    network?: string;
  }>;
};

type MetaAccountRow = {
  id: string;
  fb_page_id: string | null;
  fb_page_name: string | null;
  ig_business_user_id: string | null;
  ig_business_username: string | null;
  account_picture_url: string | null;
  status: string;
  last_error: string | null;
  user_token_expires_at: string | null;
  connected_at: string;
};

type LinkedInAccountRow = {
  id: string;
  linkedin_member_urn: string | null;
  linkedin_member_email: string | null;
  account_display_name: string | null;
  account_picture_url: string | null;
  status: string;
  last_error: string | null;
  user_token_expires_at: string | null;
  connected_at: string;
};

/**
 * Connection management for the Generate Leads feature. Surfaces
 * Meta (Phase 2A) and LinkedIn (Phase 2D — personal feed via Share
 * API, no Marketing API approval needed).
 *
 * The flash message at the top reads from `?status=…&reason=…&network=…`
 * set by the OAuth callback; rendered once then dropped via a Link
 * back to the same URL without params (handled in ConnectClient).
 */
export default async function ConnectPage({ searchParams }: PageProps) {
  const { agentId } = await getCurrentAgentContext();
  const { status, reason, count, network } = await searchParams;

  // Pull this agent's existing connections in parallel. Service-role
  // reads; the token columns are intentionally OMITTED from the
  // SELECT — they never need to leave the server.
  const [metaResult, linkedinResult] = await Promise.all([
    supabaseAdmin
      .from("social_accounts")
      .select(
        "id, fb_page_id, fb_page_name, ig_business_user_id, ig_business_username, account_picture_url, status, last_error, user_token_expires_at, connected_at",
      )
      .eq("agent_id", String(agentId))
      .eq("platform", "meta")
      .order("connected_at", { ascending: false }),
    supabaseAdmin
      .from("social_accounts")
      .select(
        "id, linkedin_member_urn, linkedin_member_email, account_display_name, account_picture_url, status, last_error, user_token_expires_at, connected_at",
      )
      .eq("agent_id", String(agentId))
      .eq("platform", "linkedin")
      .order("connected_at", { ascending: false }),
  ]);

  const metaConnections = (metaResult.data as MetaAccountRow[] | null) ?? [];
  const linkedinConnections =
    (linkedinResult.data as LinkedInAccountRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Connect platforms
          </h1>
          <p className="text-sm text-gray-500">
            Connect your social accounts so Generate Leads can publish posts
            directly.
          </p>
        </div>
        <Link
          href="/dashboard/leads/generate"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          &larr; Back
        </Link>
      </div>

      <ConnectClient
        initialStatus={status ?? null}
        initialReason={reason ?? null}
        initialCount={count ?? null}
        initialNetwork={network ?? null}
        metaConnections={metaConnections}
        linkedinConnections={linkedinConnections}
      />
    </div>
  );
}
