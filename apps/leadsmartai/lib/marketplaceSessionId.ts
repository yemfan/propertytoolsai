import { createHash } from "crypto";

export function getMarketplaceSessionId(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for") || "";
  const xRealIp = req.headers.get("x-real-ip") || "";
  const userAgent = req.headers.get("user-agent") || "";

  const ip =
    (xForwardedFor.split(",")[0] ?? "").trim() ||
    xRealIp.trim() ||
    "unknown";

  const raw = `${ip}|${userAgent}`;
  return createHash("md5").update(raw).digest("hex");
}

