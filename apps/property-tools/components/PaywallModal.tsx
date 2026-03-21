"use client";

const DEFAULT_FEATURES = [
  "Unlimited home value & CMA-style reports (fair use)",
  "Higher daily limits on calculators",
  "CRM-ready workflows & priority support",
];

export default function PaywallModal(props: {
  open: boolean;
  onClose: () => void;
  /** Primary message under the title */
  message?: string;
  title?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Optional secondary action (e.g. open login) */
  secondaryLabel?: string;
  onSecondary?: () => void;
  features?: string[];
}) {
  if (!props.open) return null;

  const features = props.features?.length ? props.features : DEFAULT_FEATURES;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div
        className="absolute inset-0"
        aria-hidden
        onClick={props.onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                PropertyTools AI
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {props.title ?? "Upgrade to Premium"}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {props.message ??
                  "You’ve hit the free limit for this tool. Upgrade for unlimited access and higher limits."}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={props.onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="space-y-4 px-5 py-5">
          <ul className="space-y-2 text-sm text-slate-700">
            {features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-0.5 text-emerald-600" aria-hidden>
                  ✓
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <a
            href={props.ctaHref ?? "/pricing"}
            className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            {props.ctaLabel ?? "View plans & upgrade"}
          </a>
          {props.onSecondary && props.secondaryLabel ? (
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={props.onSecondary}
            >
              {props.secondaryLabel}
            </button>
          ) : null}
          <p className="text-center text-[11px] text-slate-500">
            Cancel anytime · Secure checkout via Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
