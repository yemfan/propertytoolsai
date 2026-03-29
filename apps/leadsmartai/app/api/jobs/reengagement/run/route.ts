import { NextResponse } from "next/server";
import { runDailyReengagement } from "@/lib/reengagement/scheduler";

export const runtime = "nodejs";

function authorizeCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return token === secret || bearer === secret;
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runDailyReengagement();
    return NextResponse.json({ success: true, count: results.length, results });
  } catch (e) {
    console.error("reengagement job error:", e);
    return NextResponse.json({ success: false, error: "Failed to run reengagement job" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runDailyReengagement();
    return NextResponse.json({ success: true, count: results.length, results });
  } catch (e) {
    console.error("reengagement job error:", e);
    return NextResponse.json({ success: false, error: "Failed to run reengagement job" }, { status: 500 });
  }
}
