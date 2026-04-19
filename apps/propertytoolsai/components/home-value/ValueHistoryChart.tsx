"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type HistoryPoint = {
  date: string;
  value: number;
  pricePerSqft?: number;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value.toLocaleString()}`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoryPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs text-gray-500">
        {new Date(p.date).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <p className="mt-1 text-lg font-bold text-gray-900">
        ${p.value.toLocaleString()}
      </p>
      {p.pricePerSqft ? (
        <p className="text-xs text-gray-500">
          ${Math.round(p.pricePerSqft)}/sqft
        </p>
      ) : null}
    </div>
  );
}

export function ValueHistoryChart({
  address,
  currentValue,
}: {
  address: string;
  currentValue?: number;
}) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(
      `/api/home-value/history?address=${encodeURIComponent(address)}&limit=52`
    )
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.snapshots)) {
          setData(res.snapshots);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  // Need at least 2 points for a meaningful chart
  if (loading) {
    return (
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">
          Value History
        </h2>
        <div className="mt-4 flex h-[240px] items-center justify-center text-sm text-gray-400">
          Loading history...
        </div>
      </section>
    );
  }

  if (data.length < 2) {
    // Show a single-point view with the current value
    return (
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">
          Value History
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Not enough data points yet. As you check this property over time,
          a value history chart will appear here.
        </p>
        {currentValue ? (
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              ${currentValue.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">today</span>
          </div>
        ) : null}
      </section>
    );
  }

  // Calculate value change
  const oldest = data[0].value;
  const newest = data[data.length - 1].value;
  const changePct = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0;
  const changeAbs = newest - oldest;
  const isUp = changeAbs >= 0;

  // Y-axis domain with 5% padding
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.1 || maxVal * 0.05;

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">
          Value History
        </h2>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-sm font-semibold ${
              isUp ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {isUp ? "+" : ""}
            {formatCurrency(changeAbs)} ({changePct.toFixed(1)}%)
          </span>
          <span className="text-xs text-gray-400">
            since {formatDate(data[0].date)}
          </span>
        </div>
      </div>

      <div className="mt-4 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isUp ? "#059669" : "#dc2626"}
                  stopOpacity={0.15}
                />
                <stop
                  offset="100%"
                  stopColor={isUp ? "#059669" : "#dc2626"}
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f3f4f6"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              domain={[
                Math.floor((minVal - padding) / 1000) * 1000,
                Math.ceil((maxVal + padding) / 1000) * 1000,
              ]}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isUp ? "#059669" : "#dc2626"}
              strokeWidth={2.5}
              fill="url(#valueGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: isUp ? "#059669" : "#dc2626",
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
