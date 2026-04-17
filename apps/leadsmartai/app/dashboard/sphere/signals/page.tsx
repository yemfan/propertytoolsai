import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listOpenSignals } from "@/lib/sphere/service";
import SphereSignalsList from "@/components/dashboard/SphereSignalsList";

export const metadata: Metadata = {
  title: "Sphere · Signals",
  description: "Life-event signals — refi, job changes, equity milestones. Calling list only.",
  robots: { index: false },
};

export default async function SignalsPage() {
  const { agentId } = await getCurrentAgentContext();
  const signals = await listOpenSignals(agentId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-md shadow-amber-100/40">
          <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Signals</h1>
          <p className="mt-1 text-sm text-slate-600">
            Life-event signals detected from the AVM feed and external sources. These never auto-send —
            per spec §2.6.3, treat them as a calling list.
          </p>
        </div>
      </div>

      <SphereSignalsList signals={signals} />
    </div>
  );
}
