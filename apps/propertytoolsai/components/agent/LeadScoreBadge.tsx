"use client";

export function LeadScoreBadge({
  score,
  temperature,
}: {
  score: number;
  temperature: string;
}) {
  const t = String(temperature || "cold").toLowerCase();
  const color =
    t === "hot"
      ? "bg-red-100 text-red-700"
      : t === "warm"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-700";

  return (
    <div className={`rounded-full px-3 py-1 text-xs font-medium ${color}`}>
      {t.toUpperCase()} · {score}
    </div>
  );
}
