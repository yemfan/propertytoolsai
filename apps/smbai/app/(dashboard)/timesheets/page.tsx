import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listTimeEntries, getActiveTimer, getTimeStats } from "@/lib/actions/time-entries";
import { TimerClient } from "./timer-client";

export const metadata: Metadata = { title: "Timesheets" };

function weekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    from: monday.toISOString().slice(0, 10),
    to:   sunday.toISOString().slice(0, 10),
  };
}

export default async function TimesheetsPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const { from, to } = weekBounds();

  const [entries, activeTimer, stats, clientsRes, orgRes] = await Promise.all([
    listTimeEntries({ from, to }),
    getActiveTimer(),
    getTimeStats(from, to),
    supabase
      .from("clients")
      .select("id, first_name, last_name, company")
      .eq("organization_id", orgId)
      .order("first_name"),
    supabase
      .from("organizations")
      .select("default_hourly_rate")
      .eq("id", orgId)
      .single(),
  ]);

  const clients = (clientsRes.data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  }[];

  const defaultHourlyRate = Number(orgRes.data?.default_hourly_rate ?? 0) || null;

  return (
    <TimerClient
      initialEntries={entries}
      initialActiveTimer={activeTimer}
      initialStats={stats}
      clients={clients}
      defaultHourlyRate={defaultHourlyRate}
      weekFrom={from}
      weekTo={to}
    />
  );
}
