import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import {
  createSavedResult,
  listSavedResultsForUser,
} from "@/lib/savedResults/service";

export const runtime = "nodejs";

/**
 * GET /api/saved-results
 *   List the authed user's saved calculator results, newest first.
 *
 * POST /api/saved-results
 *   Create a new save. Body:
 *     { tool, label?, propertyAddress?, inputs, results }
 *
 * Both require a logged-in user. Returns 401 otherwise — the client
 * uses that signal to pop the AuthModal.
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not signed in" },
        { status: 401 },
      );
    }
    const rows = await listSavedResultsForUser(user.id);
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/saved-results:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not signed in" },
        { status: 401 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      tool?: string;
      label?: string | null;
      propertyAddress?: string | null;
      inputs?: Record<string, unknown>;
      results?: Record<string, unknown>;
    };
    if (!body.tool || typeof body.tool !== "string") {
      return NextResponse.json(
        { ok: false, error: "tool is required" },
        { status: 400 },
      );
    }
    const row = await createSavedResult({
      userId: user.id,
      tool: body.tool,
      label: typeof body.label === "string" ? body.label.trim() || null : null,
      propertyAddress:
        typeof body.propertyAddress === "string"
          ? body.propertyAddress.trim() || null
          : null,
      inputs: body.inputs && typeof body.inputs === "object" ? body.inputs : {},
      results:
        body.results && typeof body.results === "object" ? body.results : {},
    });
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/saved-results:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
