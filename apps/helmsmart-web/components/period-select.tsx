"use client";

import { useRouter } from "next/navigation";

interface Option { value: string; label: string }

interface Props {
  options: Option[];
  value: string;
  /** URL query param name to update. Defaults to "period". */
  paramName?: string;
  /** Base path to use instead of current pathname (optional). */
  basePath?: string;
}

export function PeriodSelect({ options, value, paramName = "period", basePath }: Props) {
  const router = useRouter();

  return (
    <select
      value={value}
      onChange={(e) => {
        const url = new URL(window.location.href);
        if (basePath) url.pathname = basePath;
        url.searchParams.set(paramName, e.target.value);
        router.push(url.pathname + "?" + url.searchParams.toString());
      }}
      className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
