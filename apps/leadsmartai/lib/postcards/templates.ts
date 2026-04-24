/**
 * Static postcard template library. Curated designs — not
 * user-editable. Each template maps to an animated React component
 * in components/postcards/animations/ plus the email HTML renderer.
 *
 * When adding a template: keep the default copy warm but generic.
 * The agent's personal message is what does the real work — the
 * template provides scaffolding + occasion + animation fidelity.
 */

export type PostcardTemplateKey =
  | "birthday"
  | "anniversary"
  | "holiday_seasonal"
  | "thinking_of_you";

export type PostcardTemplate = {
  key: PostcardTemplateKey;
  title: string;
  tagline: string;
  /** When the agent should pick this — used for in-app hints. */
  suggestedWhen: string;
  defaultMessage: string;
  /** Dominant color for email hero + button, and animation theme. */
  accentColor: string;
  /** Emoji shown next to the title in the picker list. */
  emojiBadge: string;
};

export const POSTCARD_TEMPLATES: PostcardTemplate[] = [
  {
    key: "birthday",
    title: "Happy Birthday",
    tagline: "Confetti burst + warm wishes",
    suggestedWhen: "Send on the contact's birthday",
    defaultMessage:
      "Wishing you a great year ahead — let me know if there's anything I can help you with, real-estate or not. Have a wonderful day!",
    accentColor: "#ec4899", // pink
    emojiBadge: "🎉",
  },
  {
    key: "anniversary",
    title: "Home Anniversary",
    tagline: "Celebrate the anniversary of their closing",
    suggestedWhen: "1 year / 5 year anniversary of mutual acceptance",
    defaultMessage:
      "It's been another year in your home — congrats! Hope it still feels as right as the day you moved in. Let me know if you ever want to talk value, refi options, or just catch up.",
    accentColor: "#0ea5e9", // sky
    emojiBadge: "🏡",
  },
  {
    key: "holiday_seasonal",
    title: "Seasonal Greetings",
    tagline: "Seasonal animation, adapts to the month",
    suggestedWhen: "Holiday season — autumn, winter, spring",
    defaultMessage:
      "Just wanted to send a quick note to say I'm thinking of you and your family this season. Wishing you warmth, rest, and great food.",
    accentColor: "#b45309", // amber-700
    emojiBadge: "🍂",
  },
  {
    key: "thinking_of_you",
    title: "Thinking of You",
    tagline: "Subtle gradient + warm opening",
    suggestedWhen: "Quiet check-in — no occasion needed",
    defaultMessage:
      "You crossed my mind today and I thought I'd reach out. Hope everything's well on your end. If there's anything I can help with, I'm here.",
    accentColor: "#8b5cf6", // violet
    emojiBadge: "💌",
  },
];

export function getPostcardTemplate(
  key: string,
): PostcardTemplate | null {
  return POSTCARD_TEMPLATES.find((t) => t.key === key) ?? null;
}
