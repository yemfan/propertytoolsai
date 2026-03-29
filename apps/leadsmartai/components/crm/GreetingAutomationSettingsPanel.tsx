"use client";

export function GreetingAutomationSettingsPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Greeting automation</h2>
      </div>
      <ul className="list-disc space-y-2 p-5 pl-8 text-sm text-slate-700">
        <li>Birthday, holiday, and home-anniversary triggers (UTC calendar).</li>
        <li>Optional mid-month check-in when last contact was 90+ days ago (15th UTC).</li>
        <li>Channel: SMS, email, or smart (lead preference + opt-outs + SMS opt-in).</li>
        <li>Daily job: <code className="text-xs bg-slate-100 px-1 rounded">GET /api/jobs/greetings/run?token=CRON_SECRET</code></li>
        <li>Per-agent settings table: <code className="text-xs bg-slate-100 px-1 rounded">greeting_automation_settings</code> (defaults apply if no row).</li>
      </ul>
    </section>
  );
}
