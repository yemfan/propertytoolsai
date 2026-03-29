/**
 * Smoke: revenue KPI tables + optional insert (requires .env.local + migration applied).
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), "../.env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const tables = [
    "agent_business_events",
    "revenue_transactions",
    "kpi_alert_rules",
    "kpi_alert_events",
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).select("id").limit(1);
    if (error) {
      console.error("FAIL", t, error.message);
      process.exit(1);
    }
    console.log("OK ", t);
  }

  console.log("\nRevenue KPI schema OK. Apply migration 20260415_revenue_kpi_system.sql if any table failed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
