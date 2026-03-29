/** Default multi-touch offsets (days after first send). Matches typical revive cadence. */
export const FOLLOW_UP_SEQUENCE = [
  { day: 0, type: "initial" as const },
  { day: 2, type: "nudge" as const },
  { day: 5, type: "last_attempt" as const },
];
