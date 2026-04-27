import { buildCmaPdf, type CmaPdfAgentIdentity } from "@/lib/cma/buildCmaPdf";
import { getCmaForAgent } from "@/lib/cma/service";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/cma/[id]/pdf
 *
 * Streams a printable / shareable CMA PDF for a saved report. Agent
 * identity (name, brokerage, license, contact info) is best-effort:
 * the PDF still generates with blank fields if any of them are
 * missing. RLS gates ownership at the DB layer; we double-check by
 * fetching with `getCmaForAgent` (returns null for unauthorized).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;

    const cma = await getCmaForAgent(String(agentId), id);
    if (!cma) {
      return new Response("Not found", { status: 404 });
    }

    const agent = await loadAgentIdentity(String(agentId));

    const bytes = buildCmaPdf({
      snapshot: cma.snapshot,
      title: cma.title,
      agent,
      generatedAtIso: cma.createdAt,
    });

    const addrSlug = cma.subjectAddress
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 60) || "cma";
    const filename = `cma-${addrSlug}-${cma.createdAt.slice(0, 10)}.pdf`;

    // jsPDF returns a Uint8Array; wrap to satisfy the Blob constructor's
    // strict BodyInit typing under lib.dom.
    const pdfBlob = new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/pdf",
    });
    return new Response(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("cma pdf:", err);
    return new Response(message, { status: 500 });
  }
}

/**
 * Pull the agent's display identity for the PDF header. All fields
 * are nullable — the PDF builder tolerates missing values gracefully.
 * Mirrors the pattern in /api/dashboard/listing-offers/[id]/net-to-seller-pdf.
 */
async function loadAgentIdentity(agentId: string): Promise<CmaPdfAgentIdentity> {
  const blank: CmaPdfAgentIdentity = {
    name: null,
    brokerage: null,
    phone: null,
    email: null,
    licenseNumber: null,
  };

  try {
    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("first_name, last_name, brokerage_name, auth_user_id, license_number")
      .eq("id", agentId)
      .maybeSingle();
    const a = agentRow as
      | {
          first_name: string | null;
          last_name: string | null;
          brokerage_name: string | null;
          auth_user_id: string | null;
          license_number: string | null;
        }
      | null;
    if (!a) return blank;

    const identity: CmaPdfAgentIdentity = {
      name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || null,
      brokerage: a.brokerage_name ?? null,
      phone: null,
      email: null,
      licenseNumber: a.license_number ?? null,
    };

    if (a.auth_user_id) {
      const [{ data: authUser }, { data: profileRow }] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(a.auth_user_id),
        supabaseAdmin
          .from("user_profiles")
          .select("phone")
          .eq("user_id", a.auth_user_id)
          .maybeSingle(),
      ]);
      identity.email = authUser?.user?.email ?? null;
      identity.phone =
        (profileRow as { phone: string | null } | null)?.phone ?? null;
    }

    return identity;
  } catch (e) {
    console.warn("[cma.pdf] loadAgentIdentity failed:", e);
    return blank;
  }
}
