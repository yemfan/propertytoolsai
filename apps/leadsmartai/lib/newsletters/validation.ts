/**
 * Pure validation for newsletter campaigns.
 *
 * Two flavors:
 *   - `validateDraft` — checks the agent saved a coherent draft
 *     (subject, at least one body, etc.). Used on save
 *   - `validateForSend` — stricter check before fanout. Adds:
 *     recipient count, unsubscribe link presence (CAN-SPAM),
 *     no leftover unrecognized template tokens
 *
 * Pure — vitest covers each branch.
 */

import { extractTokens } from "./templating";

export type ValidationIssue =
  | "missing_subject"
  | "subject_too_long"
  | "missing_body"
  | "body_too_long"
  | "no_recipients"
  | "missing_unsubscribe_link"
  | "unknown_tokens";

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
  /** Populated when `unknown_tokens` is present — useful for error
   *  copy ("These tokens won't be replaced: {{phoneNumber}}, ...") */
  unknownTokenNames?: string[];
};

const SUBJECT_MAX = 200;
const BODY_MAX = 200_000;

const KNOWN_TOKENS = new Set([
  "firstName",
  "lastName",
  "fullName",
  "email",
  "agentName",
  "unsubscribeUrl",
]);

export type DraftInput = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export function validateDraft(input: DraftInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!input.subject.trim()) issues.push("missing_subject");
  if (input.subject.length > SUBJECT_MAX) issues.push("subject_too_long");

  const hasHtml = input.bodyHtml.trim().length > 0;
  const hasText = input.bodyText.trim().length > 0;
  if (!hasHtml && !hasText) issues.push("missing_body");
  if (input.bodyHtml.length > BODY_MAX || input.bodyText.length > BODY_MAX) {
    issues.push("body_too_long");
  }

  return { ok: issues.length === 0, issues };
}

export type SendInput = DraftInput & {
  recipientCount: number;
  /** Allow extra known tokens beyond the built-in set (e.g. for
   *  campaigns that include {{propertyAddress}}). */
  allowedExtraTokens?: ReadonlyArray<string>;
};

export function validateForSend(input: SendInput): ValidationResult {
  const draftRes = validateDraft(input);
  const issues = [...draftRes.issues];

  if (input.recipientCount <= 0) issues.push("no_recipients");

  const fullText = `${input.subject}\n${input.bodyText}\n${input.bodyHtml}`;
  const hasUnsubInBody =
    fullText.includes("{{unsubscribeUrl}}") ||
    /unsubscribe/i.test(fullText);
  if (!hasUnsubInBody) issues.push("missing_unsubscribe_link");

  const allowed = new Set<string>([
    ...KNOWN_TOKENS,
    ...(input.allowedExtraTokens ?? []),
  ]);
  const usedTokens = new Set<string>();
  for (const t of extractTokens(input.subject)) usedTokens.add(t);
  for (const t of extractTokens(input.bodyText)) usedTokens.add(t);
  for (const t of extractTokens(input.bodyHtml)) usedTokens.add(t);

  // Compare case-insensitive — KNOWN_TOKENS are camelCase, agents
  // sometimes type {{firstname}}.
  const allowedLower = new Set([...allowed].map((s) => s.toLowerCase()));
  const unknown = [...usedTokens].filter((t) => !allowedLower.has(t.toLowerCase()));
  if (unknown.length > 0) {
    issues.push("unknown_tokens");
  }

  return {
    ok: issues.length === 0,
    issues,
    unknownTokenNames: unknown.length > 0 ? unknown : undefined,
  };
}
