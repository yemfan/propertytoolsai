"use client";

import type { SalesModel } from "@/lib/sales-models";

/**
 * Hero/identity block at the top of the sales-model dashboard.
 *
 * Reads the entire identity block from the model config — title,
 * philosophy, tone, lead types — so adding a new model means no UI
 * changes here.
 *
 * The visual treatment is deliberately bold (gradient + emoji + large
 * title) so the screen reads as "this is your operating mode" rather
 * than "settings page". The colored gradient changes per model id so
 * agents get a small visual anchor when switching.
 */
export function IdentityBlock({ model }: { model: SalesModel }) {
  return (
    <section
      aria-label="Operating identity"
      className={[
        "relative overflow-hidden rounded-2xl border bg-white p-6 md:p-8",
        "ring-1 ring-slate-900/[0.04] shadow-sm",
        "border-slate-200",
      ].join(" ")}
    >
      <div
        aria-hidden
        className={[
          "absolute inset-0 -z-10 opacity-60",
          gradientFor(model.id),
        ].join(" ")}
      />
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow ring-1 ring-slate-900/10"
          aria-hidden
        >
          {model.emoji}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {model.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 md:text-3xl">
            {model.identityTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 md:text-base">
            {model.philosophy}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DefRow label="Communication style" value={model.tone} />
        <DefRow label="Best-fit lead types" value={model.leadTypes.join(", ")} />
      </dl>
    </section>
  );
}

function DefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/70 p-3 ring-1 ring-slate-200/80 backdrop-blur">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function gradientFor(id: SalesModel["id"]): string {
  switch (id) {
    case "influencer":
      return "bg-gradient-to-br from-fuchsia-100 via-rose-50 to-amber-50";
    case "closer":
      return "bg-gradient-to-br from-blue-100 via-sky-50 to-slate-100";
    case "advisor":
      return "bg-gradient-to-br from-emerald-100 via-teal-50 to-blue-50";
    case "custom":
      return "bg-gradient-to-br from-slate-100 via-white to-slate-100";
  }
}
