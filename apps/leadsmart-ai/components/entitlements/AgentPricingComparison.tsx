import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_CATALOG } from "@/lib/entitlements/planCatalog";
import type { AgentPlanId } from "@/lib/entitlements/types";
import type { PlanCatalogEntry } from "@/lib/entitlements/planCatalog";

const ORDER: AgentPlanId[] = ["starter", "growth", "elite"];

function PlanCard({
  id,
  entry,
  highlight,
}: {
  id: AgentPlanId;
  entry: PlanCatalogEntry;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 shadow-sm ${
        highlight ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{entry.label}</h3>
        {highlight ? (
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Popular
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {id === "starter" && "Entry workspace"}
        {id === "growth" && "Scaling teams"}
        {id === "elite" && "Unlimited scale + team"}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {entry.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 text-xs text-slate-500">
        Upgrade path:{" "}
        <span className="font-medium text-slate-700">
          Starter → Growth → Elite (higher caps + team)
        </span>
      </div>
    </div>
  );
}

export function AgentPricingComparison() {
  return (
    <section id="plans" className="scroll-mt-24">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Agent plans & limits</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Every tier unlocks the same LeadSmart Agent workspace — limits scale with your plan. Start on Starter, move
        to Growth for pipeline volume, and Elite when you need automation + team seats.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {ORDER.map((id) => (
          <PlanCard key={id} id={id} entry={PLAN_CATALOG[id]} highlight={id === "growth"} />
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-slate-600">
        Need help choosing?{" "}
        <Link href="/pricing" className="font-semibold text-blue-700 hover:text-blue-800">
          Open full pricing
        </Link>
      </p>
    </section>
  );
}
