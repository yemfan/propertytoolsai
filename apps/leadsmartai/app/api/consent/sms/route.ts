import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/consent/sms
 *
 * Records the current user's SMS consent for TCPA audit. Captures:
 *   - `sms_consent_accepted_at` (server clock)
 *   - `sms_consent_ip` (from X-Forwarded-For / remote)
 *   - `sms_consent_user_agent` (from request header)
 *   - `sms_consent_version` (from body, product-controlled)
 *
 * The signup form calls this right after the account is created. IP cannot
 * be reliably captured in the browser, so going through the server is the
 * clean way to get a defensible audit trail.
 *
 * Request body: `{ version: string }` — the disclosure text version shown.
 * Currently "v1" but bump whenever the disclosure language materially changes.
 *
 * Response: `{ ok: true, acceptedAt: ISO }` or 4xx on error.
 */
export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { version?: string };
    const version = typeof body.version === "string" && body.version.trim() ? body.version.trim() : "v1";

    // Extract IP — Vercel/most proxies populate X-Forwarded-For.
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const firstHop = xff.split(",")[0]?.trim();
    const realIp = req.headers.get("x-real-ip") ?? "";
    const ip = firstHop || realIp || null;

    const userAgent = req.headers.get("user-agent") ?? null;
    const acceptedAt = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("user_profiles")
      .update({
        sms_consent_accepted_at: acceptedAt,
        sms_consent_ip: ip,
        sms_consent_user_agent: userAgent?.slice(0, 500) ?? null,
        sms_consent_version: version.slice(0, 32),
      } as never)
      .eq("user_id", user.id);

    if (error) {
      // Fail-open on column missing — migration hasn't landed yet in this env.
      // Log so ops notices, but don't block the signup flow.
      if (/does not exist|schema cache/i.test(error.message ?? "")) {
        console.warn("[consent/sms] user_profiles consent columns missing — migration pending", {
          code: (error as { code?: string }).code,
        });
        return NextResponse.json({ ok: true, acceptedAt, persisted: false });
      }
      console.error("[consent/sms] update failed", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, acceptedAt, persisted: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[consent/sms] unhandled", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
