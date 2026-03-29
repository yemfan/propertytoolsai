import { ReactNode } from "react";

export default function Section({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description?: string;
  /** Small label above title (brand accent) */
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">{eyebrow}</p>
        ) : null}
        <h2 className="font-heading text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
