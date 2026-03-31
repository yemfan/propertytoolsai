import { CallLogPanel } from "@/components/crm/CallLogPanel";

export default function CallsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Voice call log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inbound Twilio calls linked to leads. Configure webhooks in Twilio and apply DB migrations for{" "}
          <code className="rounded bg-slate-100 px-1">lead_calls</code>.
        </p>
      </div>
      <CallLogPanel />
    </div>
  );
}
