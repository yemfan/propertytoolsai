import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { registerMobilePushToken } from "@/lib/mobile/pushNotificationsService";
import type { MobilePushRegisterRequestDto } from "@leadsmart/shared";

export const runtime = "nodejs";

const PLATFORMS = new Set(["ios", "android", "web", "unknown"]);

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<MobilePushRegisterRequestDto>;

    const token = String(body.expoPushToken ?? "").trim();
    if (!token || token.length < 10) {
      return NextResponse.json(
        { ok: false, success: false, error: "expoPushToken is required" },
        { status: 400 }
      );
    }

    const rawPlatform = String(body.platform ?? "unknown").toLowerCase();
    const platform = PLATFORMS.has(rawPlatform)
      ? (rawPlatform as "ios" | "android" | "web" | "unknown")
      : "unknown";

    await registerMobilePushToken({
      userId: auth.ctx.userId,
      agentId: auth.ctx.agentId,
      expoPushToken: token,
      platform,
      deviceId: body.deviceId ?? null,
      appVersion: body.appVersion ?? null,
    });

    return NextResponse.json({ ok: true, success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/push/register", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
