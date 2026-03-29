"use client";

export function AiAssistantSettingsPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">AI SMS assistant</h2>
      </div>
      <ul className="list-disc space-y-2 p-5 pl-8 text-sm text-slate-700">
        <li>Instant replies on inbound SMS when the lead is opted in and AI is enabled.</li>
        <li>Urgent, legal-risk, or angry messages can be escalated to agents via nurture alerts.</li>
        <li>Buyer / seller / financing intents are classified and can update CRM fields when extracted.</li>
        <li>
          Configure Twilio to POST to{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">/api/sms/webhook</code> or{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">/api/twilio/sms/inbound</code> (same handler).
        </li>
      </ul>
    </section>
  );
}
