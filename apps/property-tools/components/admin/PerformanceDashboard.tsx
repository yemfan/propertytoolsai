"use client";

import { PerformanceOverviewPanel } from "./PerformanceOverviewPanel";
import { PerformanceBySourcePanel } from "./PerformanceBySourcePanel";
import { PerformanceByAgentPanel } from "./PerformanceByAgentPanel";
import { PerformanceFunnelPanel } from "./PerformanceFunnelPanel";

export function PerformanceDashboard() {
  return (
    <div className="grid gap-6">
      <PerformanceOverviewPanel />
      <PerformanceFunnelPanel />
      <PerformanceBySourcePanel />
      <PerformanceByAgentPanel />
    </div>
  );
}
