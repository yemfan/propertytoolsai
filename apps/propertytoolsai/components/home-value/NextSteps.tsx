"use client";

export function NextSteps({ actions }: { actions: string[] }) {
  if (!actions.length) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Suggested Next Steps</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <div key={action} className="rounded-2xl border border-slate-200 bg-gray-50 p-5">
            <div className="text-sm font-medium text-gray-900">{action}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
