import type { ReactNode } from "react";

export function RbacPageShell({
  title,
  description,
  roleLabel,
  children,
}: {
  title: string;
  description?: string;
  roleLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">Role-protected</p>
        <h1 className="mt-1 font-heading text-2xl font-bold text-slate-900">{title}</h1>
        {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800">
          <span className="text-slate-500">Your role</span>
          <span className="font-mono text-[11px] uppercase tracking-wide">{roleLabel}</span>
        </p>
        {children ? <div className="mt-6 border-t border-slate-100 pt-6">{children}</div> : null}
      </div>
    </div>
  );
}
