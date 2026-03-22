import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Numbered sections for the home value page (hero, preview, refine, gate, report, next steps, expert).
 */
export default function HomeValueSection({ id, title, description, children, className = "" }: Props) {
  return (
    <section id={id} className={`scroll-mt-20 ${className}`} aria-labelledby={`${id}-heading`}>
      <div className="mb-3 border-b border-slate-100 pb-2">
        <h2 id={`${id}-heading`} className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
