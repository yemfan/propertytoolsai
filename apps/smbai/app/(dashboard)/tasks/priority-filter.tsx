"use client";

export function PriorityFilter({
  statusFilter,
  priorityFilter,
}: {
  statusFilter: string;
  priorityFilter: string;
}) {
  return (
    <select
      defaultValue={priorityFilter}
      onChange={(e) => {
        const p = e.target.value;
        const base = statusFilter ? `?status=${statusFilter}` : "?";
        const sep = statusFilter ? "&" : "";
        window.location.href = p
          ? `/tasks${base}${sep}priority=${p}`
          : `/tasks${statusFilter ? `?status=${statusFilter}` : ""}`;
      }}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <option value="">All priorities</option>
      <option value="urgent">Urgent</option>
      <option value="high">High</option>
      <option value="normal">Normal</option>
      <option value="low">Low</option>
    </select>
  );
}
