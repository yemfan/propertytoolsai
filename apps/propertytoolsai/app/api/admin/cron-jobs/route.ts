/**
 * Admin API: list cron jobs and manually trigger them.
 *
 * GET  /api/admin/cron-jobs          → list of jobs with schedule + last-run info
 * POST /api/admin/cron-jobs          → { path: "/api/cron/…" } to trigger a job now
 *
 * Both endpoints require an authenticated admin session.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSiteUrl } from "@/lib/siteUrl";

// ─── Job registry (mirrors vercel.json crons) ────────────────────────────────

export interface CronJob {
  id: string;
  label: string;
  path: string;
  schedule: string;
  description: string;
  category: "seo" | "leads" | "emails" | "valuation" | "data" | "tasks";
}

export const CRON_JOBS: CronJob[] = [
  // SEO
  { id: "seo-refresh",            label: "SEO Refresh",               path: "/api/jobs/seo-refresh",               schedule: "0 3 * * *",   description: "Refresh stale SEO pages (168h+, up to 200 pages)",                           category: "seo" },
  { id: "seo-expand",             label: "SEO Expand",                path: "/api/jobs/seo-expand",                schedule: "30 3 * * *",  description: "Queue and generate new topic×location cluster pages",                        category: "seo" },
  { id: "seo-optimize",           label: "SEO Optimize",              path: "/api/jobs/seo-optimize",              schedule: "0 4 * * *",   description: "Optimise high-traffic pages with low lead conversion",                       category: "seo" },
  { id: "seo-content-opt",        label: "SEO Content Optimization",  path: "/api/cron/seo-content-optimization",  schedule: "0 5 * * 0",   description: "Weekly OpenAI content quality pass (requires SEO_OPT_WEEKLY_LIMIT)",         category: "seo" },
  { id: "cluster-generator",      label: "Cluster Generator",         path: "/api/cron/cluster-generator",         schedule: "0 6 * * *",   description: "Generate new cluster pages for missing topic×location pairs",                 category: "seo" },
  { id: "keyword-discovery",      label: "Keyword Discovery",         path: "/api/cron/keyword-discovery",         schedule: "0 2 * * 1",   description: "Expand keyword database from seed list (weekly, Mondays)",                    category: "seo" },
  // Leads
  { id: "lead-score-refresh",     label: "Lead Score Refresh",        path: "/api/cron/lead-score-refresh",        schedule: "0 1 * * *",   description: "Re-score all active leads daily",                                            category: "leads" },
  { id: "lead-followups",         label: "Lead Follow-ups",           path: "/api/cron/lead-followups",            schedule: "0 * * * *",   description: "Process queued follow-up jobs (email + SMS) – runs hourly",                  category: "leads" },
  { id: "smart-match-daily",      label: "Smart Match Digest",        path: "/api/cron/smart-match-daily",         schedule: "0 9 * * *",   description: "Send daily property-match digest emails to subscribers",                     category: "leads" },
  { id: "smart-automation",       label: "Smart Automation",          path: "/api/cron/smart-automation",          schedule: "0 */6 * * *", description: "Rule-based follow-ups (report_view, engagement, inactivity) – every 6h",    category: "leads" },
  { id: "lead-pricing-learning",  label: "Lead Pricing Learning",     path: "/api/cron/lead-pricing-learning",     schedule: "0 2 * * 3",   description: "Learning loop for lead pricing model (Wednesdays)",                          category: "leads" },
  // Emails
  { id: "send-emails",            label: "Send Emails",               path: "/api/cron/send-emails",               schedule: "30 * * * *",  description: "Send queued outbound emails and SMS – runs hourly",                         category: "emails" },
  // Valuation
  { id: "valuation-calibration",  label: "Valuation Calibration",     path: "/api/jobs/valuation-calibration",     schedule: "0 1 * * *",   description: "Auto-calibrate AVM model weights from recent sold data",                    category: "valuation" },
  // Data
  { id: "city-data-refresh",      label: "City Data Refresh",         path: "/api/cron/city-data-refresh",         schedule: "0 5 * * 1",   description: "Refresh local market stats (price, inventory, DOM) – Mondays",             category: "data" },
  { id: "leadsmart-refresh",      label: "LeadSmart Refresh",         path: "/api/cron/leadsmart-refresh",         schedule: "30 5 * * *",  description: "Refresh lead batch from LeadSmart service",                                  category: "data" },
  // Tasks
  { id: "tasks-deferred",         label: "Deferred Tasks",            path: "/api/cron/tasks-deferred",            schedule: "0 7 * * *",   description: "Move deferred tasks to active when their due date arrives",                 category: "tasks" },
];

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: false; res: NextResponse } | { ok: true }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  }

  // Check admin role
  const { data: profile } = await supabase
    .from("propertytools_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true };
}

// ─── GET – list jobs ──────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return ("res" in auth ? auth.res : NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

  return NextResponse.json({ ok: true, jobs: CRON_JOBS });
}

// ─── POST – trigger a job ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return ("res" in auth ? auth.res : NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

  const body = await req.json().catch(() => ({}));
  const path = typeof body.path === "string" ? body.path.trim() : "";

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const job = CRON_JOBS.find((j) => j.path === path);
  if (!job) {
    return NextResponse.json({ error: "Unknown job path" }, { status: 404 });
  }

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const secret = process.env.CRON_SECRET?.trim();

  const targetUrl = `${siteUrl}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const start = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(120_000), // 2 min max
    });

    const duration = Date.now() - start;
    let result: unknown;
    try {
      result = await res.json();
    } catch {
      result = { raw: await res.text() };
    }

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      duration,
      result,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message ?? "Request failed",
      duration: Date.now() - start,
    });
  }
}
