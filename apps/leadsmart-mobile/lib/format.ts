/** Short label for a task due timestamp (local calendar day vs today). */
export function formatTaskDueLabel(iso: string | null): string {
  if (!iso) return "No date";
  try {
    const d = new Date(iso);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayMs = 86_400_000;
    if (startDue < startToday) return "Overdue";
    if (startDue === startToday) return "Today";
    if (startDue === startToday + dayMs) return "Tomorrow";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Due";
  }
}

/** Clock only (e.g. "9:00 AM") for agenda rows. */
export function formatAgendaClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Short date/time for thread rows and message bubbles. */
export function formatShortDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
