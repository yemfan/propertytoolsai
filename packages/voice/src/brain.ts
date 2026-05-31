// Shared types for the AI receptionist's structured "brain" (hours, appointment
// types, knowledge). Pure module — imported by server actions, the voice loop,
// the config UI, and the date/time helpers. Used by every app that runs the
// voice agent.

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Open/close in 24h "HH:MM" (org timezone). null = closed that day. */
export type DayHours = { open: string; close: string } | null;

export type BusinessHours = Record<DayKey, DayHours>;

export type AppointmentType = {
  id: string;
  name: string;
  duration_minutes: number;
  description: string | null;
  active: boolean;
  sort: number;
};

export type KnowledgeEntry = {
  id: string;
  title: string;
  content: string;
  active: boolean;
  sort: number;
};

/** A reasonable default: Mon–Fri 9–5, weekends closed. */
export function defaultBusinessHours(): BusinessHours {
  const weekday: DayHours = { open: "09:00", close: "17:00" };
  return { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: null, sun: null };
}

/** Render the hours as a compact line for the agent's prompt. */
export function describeHours(hours: BusinessHours | null): string {
  if (!hours) return "Business hours not set.";
  return DAY_KEYS.map((d) => {
    const h = hours[d];
    return `${DAY_LABELS[d]}: ${h ? `${h.open}–${h.close}` : "closed"}`;
  }).join("\n");
}
