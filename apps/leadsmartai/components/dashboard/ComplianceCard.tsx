const ITEMS = [
  {
    label: "STOP / HELP handling (bilingual)",
    description:
      "STOP, UNSUBSCRIBE, CANCEL, QUIT, END (English) and 停止, 退订, 取消 (Chinese) suppress all future messages permanently. HELP and 帮助 return your contact info. Inherits from 10DLC registration.",
  },
  {
    label: "First-SMS opt-out disclosure",
    description:
      "First SMS to any new contact appends \u201CReply STOP to opt out\u201D — or the Chinese equivalent if the contact's language preference is Chinese. Suppressed on subsequent messages in the same thread.",
  },
  {
    label: "Agent-of-record check for equity messages",
    description:
      "Templates with home value estimates (EQ-01, EM-01, EM-02) only send if you represented the contact on that specific property. Prevents steering and dual-agency accusations.",
    source: "Per spec §2.8",
  },
  {
    label: "California AVM disclosure (AB 2863)",
    description:
      "If your registered state is California, required disclosure language auto-appends to AVM email variants. SMS variants are suppressed in regulated states — the disclosure doesn't fit in 160 chars.",
    source: "Per spec §2.8 — NEEDS LEGAL REVIEW",
  },
  {
    label: "30-day draft-only window for new agents",
    description:
      "In your first 30 days, every template defaults to Review mode regardless of your policy setting. Autosend becomes available on day 31.",
    source: "Per spec §2.4",
  },
  {
    label: "Anniversary opt-in required on import",
    description:
      "Past-client imports require you to confirm each contact has consented to SMS. The anniversary_opt_in flag defaults to false. No anniversary trigger fires without explicit opt-in.",
    source: "Per spec §2.8",
  },
];

export default function ComplianceCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Compliance</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Behaviors that are enforced automatically and can&apos;t be overridden. Real-estate messaging is more
        legally sensitive than most SaaS allows for.
      </p>

      <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
        {ITEMS.map((item) => (
          <div key={item.label} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium text-gray-900">{item.label}</div>
              <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                Always on
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-600">{item.description}</div>
            {item.source && (
              <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">{item.source}</div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-gray-500">
        <strong className="font-semibold text-gray-700">Legal notice.</strong> These guardrails implement the spec&apos;s
        compliance requirements but do not constitute legal advice. If you send messaging at scale or operate
        in multiple states, have your own counsel review the behavior before you rely on it.
      </p>
    </div>
  );
}
