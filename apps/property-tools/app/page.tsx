import Card from "@/components/ui/Card";
import QuickActions from "@/components/dashboard/QuickActions";
import ToolGrid from "@/components/dashboard/ToolGrid";
import NextSteps from "@/components/NextSteps";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <QuickActions />

      <NextSteps />

      <ToolGrid />

      <Card className="p-5">
        <h3 className="text-base font-bold text-slate-900">Activity Snapshot</h3>
        <p className="mt-2 text-sm text-slate-600">
          Tool usage, saved scenarios, and recent calculations will appear here as your workspace
          grows.
        </p>
      </Card>
    </div>
  );
}

