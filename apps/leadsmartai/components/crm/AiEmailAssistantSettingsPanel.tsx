"use client";

export function AiEmailAssistantSettingsPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">AI email assistant</h2>
      </div>
      <ul className="list-disc space-y-2 p-5 pl-8 text-sm text-slate-700">
        <li>Inbound: POST to <code className="rounded bg-slate-100 px-1 text-xs">/api/ai-email/process-inbound</code> with Bearer <code className="text-xs">AI_EMAIL_INBOUND_SECRET</code> in production.</li>
        <li>Outbound: Resend when <code className="text-xs">RESEND_API_KEY</code> is set; optional <code className="text-xs">RESEND_FROM_EMAIL</code>.</li>
        <li>Draft-only: set <code className="text-xs">EMAIL_AI_DRAFT_ONLY=true</code> to log replies without delivering.</li>
        <li>Hot / human-needed threads can notify the assigned agent (same pipeline as SMS when enabled).</li>
      </ul>
    </section>
  );
}
