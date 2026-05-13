import { NextResponse } from "next/server";
import { z } from "zod";

import { publishPost } from "@/lib/leads-gen/publish";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Meta orchestration includes container creation + publish, can run
// several seconds. Budget generously.
export const maxDuration = 60;

const bodySchema = z.object({
  platform: z.enum(["facebook", "instagram", "linkedin"]),
  connectionId: z.string().uuid(),
  caption: z.string().min(1).max(5_000),
  hashtags: z.array(z.string()).max(40).optional(),
  /** Optional media_library.id. Required for Instagram (Meta API),
   *  optional for Facebook and LinkedIn. Mobile doesn't include a
   *  media-upload flow yet, so this is typically omitted — agents
   *  post text-only to FB / LinkedIn from the phone and use the
   *  Share sheet for IG. The field stays open for forward-compat
   *  with the upcoming mobile media picker. */
  mediaItemId: z.string().uuid().optional(),
  trigger: z.string().max(64).optional(),
  subjectKind: z.string().max(64).optional(),
  subjectRefId: z.string().max(255).optional(),
});

/**
 * POST /api/mobile/leads-gen/publish
 *
 * Mobile-side counterpart to /api/leads-gen/publish. Thin wrapper
 * around `publishPost` (shared with cron + web). Same plan gate
 * (Pro+) and same discriminated-union failure mapping translated
 * into the mobile envelope.
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("plan_type")
      .eq("id", auth.ctx.agentId)
      .maybeSingle();
    const planType = (
      (agentRow as { plan_type: string | null } | null)?.plan_type ?? "free"
    ).toLowerCase();
    if (planType === "free") {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Direct publishing requires Pro or higher.",
        },
        { status: 402 },
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Invalid body",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await publishPost({
      agentId: auth.ctx.agentId,
      platform: parsed.data.platform,
      connectionId: parsed.data.connectionId,
      caption: parsed.data.caption,
      hashtags: parsed.data.hashtags,
      mediaItemId: parsed.data.mediaItemId ?? null,
      trigger: parsed.data.trigger ?? null,
      subjectKind: parsed.data.subjectKind ?? null,
      subjectRefId: parsed.data.subjectRefId ?? null,
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        success: true,
        postId: result.leadPostId,
        externalPostId: result.externalPostId,
        externalPostUrl: result.externalPostUrl,
        platform: result.platform,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: result.error,
        metaCode: result.metaCode ?? null,
        metaTraceId: result.metaTraceId ?? null,
        linkedinCode: result.linkedinCode ?? null,
        linkedinServiceErrorCode: result.linkedinServiceErrorCode ?? null,
        postId: result.leadPostId ?? null,
      },
      { status: result.status },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Publish failed";
    console.error("[mobile/leads-gen/publish]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
