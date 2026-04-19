import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { loadAgentSignatureProfile } from "@/lib/signatures/loadProfile";
import { composeSignature } from "@/lib/signatures/compose";

export const runtime = "nodejs";

/**
 * Render the agent's email signature as HTML + text.
 *
 * GET  → preview with whatever's currently saved.
 * POST → preview with in-flight edits from the settings form (body
 *        fields override the stored agent row). Lets the Profile
 *        page's Preview button show the user exactly what their
 *        unsaved changes will render as.
 *
 * The endpoint is agent-scoped; no contact context needed because
 * signatures are always the agent's, never the contact's.
 */

type PreviewOverrides = {
  brandName?: unknown;
  signatureHtml?: unknown;
  logoUrl?: unknown;
  agentPhotoUrl?: unknown;
};

async function render(overrides: PreviewOverrides) {
  const { agentId } = await getCurrentAgentContext();
  const base = await loadAgentSignatureProfile(agentId);
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "Agent profile not found" },
      { status: 403 },
    );
  }

  const str = (v: unknown): string | null | undefined =>
    typeof v === "string" ? v : v === null ? null : undefined;

  const merged = {
    ...base,
    // Only override fields the caller explicitly sent. `undefined` = keep,
    // `""` or `null` = clear (lets a user preview "remove my signature").
    brandName: overrides.brandName === undefined ? base.brandName : str(overrides.brandName) ?? null,
    signatureHtml:
      overrides.signatureHtml === undefined ? base.signatureHtml : str(overrides.signatureHtml) ?? null,
    logoUrl: overrides.logoUrl === undefined ? base.logoUrl : str(overrides.logoUrl) ?? null,
    agentPhotoUrl:
      overrides.agentPhotoUrl === undefined ? base.agentPhotoUrl : str(overrides.agentPhotoUrl) ?? null,
  };

  const signature = composeSignature(merged);
  return NextResponse.json({
    ok: true,
    signature,
    profile: {
      firstName: merged.firstName,
      lastName: merged.lastName,
      fullName: merged.fullName,
      email: merged.email,
      phone: merged.phone,
      brandName: merged.brandName,
      agentPhotoUrl: merged.agentPhotoUrl,
      logoUrl: merged.logoUrl,
    },
  });
}

export async function GET() {
  try {
    return await render({});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as PreviewOverrides;
    return await render(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
