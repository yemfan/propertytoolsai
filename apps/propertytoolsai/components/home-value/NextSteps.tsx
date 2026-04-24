"use client";

import Link from "next/link";

/**
 * Next-steps CTAs under a home-value report.
 *
 * Backwards-compatible input: accepts either the modern
 * `{ title, href, reason }` shape OR a plain string (legacy
 * callers that haven't migrated yet). String-only entries render
 * with a neutral anchor to `/` so they're still clickable rather
 * than silently inert.
 */

type NextStepAction =
  | string
  | { title: string; href?: string; reason?: string };

export function NextSteps({ actions }: { actions: NextStepAction[] }) {
  if (!actions.length) return null;

  const normalized = actions
    .map((a) => (typeof a === "string" ? { title: a } : a))
    .filter((a): a is { title: string; href?: string; reason?: string } =>
      Boolean(a?.title),
    );

  if (!normalized.length) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
        Suggested Next Steps
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {normalized.map((action, i) => {
          const href = action.href ?? "/";
          const isExternal = /^https?:\/\//i.test(href);
          const Comp = isExternal ? "a" : Link;
          const extra = isExternal
            ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
            : {};
          return (
            <Comp
              key={`${action.title}-${i}`}
              href={href}
              {...extra}
              className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-gray-50 p-5 transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-800">
                  {action.title}
                </div>
                {action.reason ? (
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">
                    {action.reason}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                Get started
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Comp>
          );
        })}
      </div>
    </section>
  );
}
