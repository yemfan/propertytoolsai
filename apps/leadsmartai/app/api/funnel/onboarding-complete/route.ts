import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { markOnboardingCompleted } from "@/lib/funnel/funnelAnalytics";

export const runtime = "nodejs";

const bodySchema = z.object({
  source: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    const source = parsed.success ? parsed.data.source : undefined;

    await markOnboardingCompleted(user.id, source);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
