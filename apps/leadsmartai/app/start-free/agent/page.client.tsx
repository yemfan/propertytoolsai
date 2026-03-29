import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { AgentPricingComparison } from "@/components/entitlements/AgentPricingComparison";
import { StartFreeAgentActions } from "@/components/entitlements/StartFreeAgentActions";
import { PLAN_CATALOG } from "@/lib/entitlements/planCatalog";

type Props = {
  backHref: string;
};

export default function StartFreeAgentClientPage({ backHref }: Props) {
  const starter = PLAN_CATALOG.starter;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          You’re already signed in
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Activate the LeadSmart Agent workspace
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          Your account is ready — add an active <strong>LeadSmart Agent</strong> entitlement to open the CRM, AI
          tools, and pipeline. Start with the <strong>Starter</strong> plan (free trial) to get core limits while you
          evaluate, then upgrade when you need more volume.
        </p>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Starter includes</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {starter.bullets.map((line) => (
              <li key={line} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <StartFreeAgentActions backHref={backHref} />
        </div>

        <div className="mt-16 border-t border-slate-200 pt-16">
          <AgentPricingComparison />
        </div>

        <div className="mt-12 text-center text-sm text-slate-600">
          Questions? See{" "}
          <Link href="/agent/pricing" className="font-semibold text-blue-700 hover:text-blue-800">
            pricing & billing
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
