"use client";

import type { DatePreset, DateRange } from "@/lib/dashboard/dateRange";
import { getPresetDateRange } from "@/lib/dashboard/dateRange";

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
};

const presets: { label: string; value: DatePreset }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "MTD", value: "mtd" },
];

export function DateRangeFilter({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = value.preset === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(getPresetDateRange(preset.value))}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="date"
          value={value.start}
          onChange={(e) =>
            onChange({ ...value, preset: "custom", start: e.target.value })
          }
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={value.end}
          onChange={(e) =>
            onChange({ ...value, preset: "custom", end: e.target.value })
          }
          className="rounded-xl border px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
