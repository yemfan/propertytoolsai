"use client";

export type PipelineStageLike = {
  id: string;
  label: string;
  description: string;
};

export default function TransactionPipeline({
  stages,
  activeIndex,
}: {
  stages: PipelineStageLike[];
  activeIndex: number;
}) {
  return (
    <div className="overflow-x-auto pb-2 -mx-1">
      <ol className="flex gap-2 min-w-max px-1">
        {stages.map((s, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          return (
            <li
              key={s.id}
              className={`rounded-xl border px-3 py-2 max-w-[140px] shrink-0 ${
                current
                  ? "border-blue-500 bg-blue-50 text-blue-900"
                  : done
                    ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <div className="text-[11px] font-bold leading-tight">{s.label}</div>
              <div className="text-[10px] mt-1 leading-snug opacity-90">{s.description}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
