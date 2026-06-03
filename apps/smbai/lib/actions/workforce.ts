"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  seedCoreRoster,
  listEmployees,
  getMetrics,
  type AiEmployee,
  type AiEmployeeMetric,
} from "@helm/ai-workforce";

async function orgScope() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");
  const supabase = await createClient();
  return { orgId, supabase };
}

/** Seed the six Core AI employees into the current org (idempotent — safe to re-run). */
export async function seedWorkforce(): Promise<{ seeded: number }> {
  const { orgId, supabase } = await orgScope();
  return seedCoreRoster(supabase, orgId);
}

/** The org's AI employees, for the workforce settings UI. */
export async function getWorkforce(): Promise<AiEmployee[]> {
  const { orgId, supabase } = await orgScope();
  return listEmployees(supabase, orgId);
}

/** Daily AI-workforce metrics across a date range — the Command Center's KPI source. */
export async function getWorkforceMetrics(from: string, to: string): Promise<AiEmployeeMetric[]> {
  const { orgId, supabase } = await orgScope();
  return getMetrics(supabase, orgId, { from, to });
}
