"use client";

export default function PaywallModal(props: {
  open: boolean;
  onClose: () => void;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Upgrade to continue</div>
            <div className="text-xs text-slate-600 mt-1">
              {props.message ?? "You’ve reached your free limit. Upgrade to continue."}
            </div>
          </div>
          <button
            type="button"
            className="text-sm font-semibold px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>
        <div className="p-5 space-y-3">
          <a
            href={props.ctaHref ?? "/pricing"}
            className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {props.ctaLabel ?? "Start Free Trial"}
          </a>
          <p className="text-[11px] text-slate-500">
            Unlock CRM, alerts, dashboard insights, and higher usage limits.
          </p>
        </div>
      </div>
    </div>
  );
}

