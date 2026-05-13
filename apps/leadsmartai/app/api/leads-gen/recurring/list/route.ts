import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/recurring/list
 *
 * Returns this agent's recurring post schedules + a count of
 * scheduled_posts each has materialized so far. Used by the
 * recurring-posts management page.
 */
export async function GET() {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const { data, error } = await supabaseAdmin
      .from("recurring_post_schedules")
      .select(
        "id, platform, caption, cadence, weekly_day_of_week, time_of_day_hour, time_of_day_minute, timezone, starts_at, ends_at, max_occurrences, occurrence_count, next_occurrence_at, last_materialized_at, status, last_error, social_account_id, created_at",
      )
      .eq("agent_id", auth.agentId)
      .order("status", { ascending: true }) // active first
      .order("next_occurrence_at", { ascending: true });
    if (error) throw error;

    // Enrich with connection display + materialized-count.
    const rows = (data ?? []) as Array<{
      id: string;
      platform: string;
      caption: string;
      cadence: "daily" | "weekly";
      weekly_day_of_week: number | null;
      time_of_day_hour: number;
      time_of_day_minute: number;
      timezone: string;
      starts_at: string;
      ends_at: string | null;
      max_occurrences: number | null;
      occurrence_count: number;
      next_occurrence_at: string;
      last_materialized_at: string | null;
      status: "active" | "paused" | "completed" | "cancelled";
      last_error: string | null;
      social_account_id: string;
      created_at: string;
    }>;

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, recurrences: [] });
    }

    // Pull display names from social_accounts in one go.
    const accountIds = Array.from(new Set(rows.map((r) => r.social_account_id)));
    const { data: accounts } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, platform, fb_page_name, ig_business_username, account_display_name",
      )
      .in("id", accountIds);
    const accountById = new Map<
      string,
      {
        platform: string;
        fb_page_name: string | null;
        ig_business_username: string | null;
        account_display_name: string | null;
      }
    >();
    for (const a of (accounts as Array<{
      id: string;
      platform: string;
      fb_page_name: string | null;
      ig_business_username: string | null;
      account_display_name: string | null;
    }> | null) ?? []) {
      accountById.set(a.id, a);
    }

    const recurrences = rows.map((r) => {
      const acct = accountById.get(r.social_account_id);
      let displayName: string | null = null;
      if (acct) {
        if (r.platform === "instagram" && acct.ig_business_username) {
          displayName = `@${acct.ig_business_username}`;
        } else if (r.platform === "facebook" && acct.fb_page_name) {
          displayName = acct.fb_page_name;
        } else if (r.platform === "linkedin" && acct.account_display_name) {
          displayName = acct.account_display_name;
        }
      }
      return {
        id: r.id,
        platform: r.platform,
        caption: r.caption,
        cadence: r.cadence,
        weeklyDayOfWeek: r.weekly_day_of_week,
        timeOfDayHour: r.time_of_day_hour,
        timeOfDayMinute: r.time_of_day_minute,
        timezone: r.timezone,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        maxOccurrences: r.max_occurrences,
        occurrenceCount: r.occurrence_count,
        nextOccurrenceAt: r.next_occurrence_at,
        lastMaterializedAt: r.last_materialized_at,
        status: r.status,
        lastError: r.last_error,
        socialAccountId: r.social_account_id,
        socialAccountDisplay: displayName,
        createdAt: r.created_at,
      };
    });

    return NextResponse.json({ ok: true, recurrences });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load recurring";
    console.error("[leads-gen/recurring/list]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
