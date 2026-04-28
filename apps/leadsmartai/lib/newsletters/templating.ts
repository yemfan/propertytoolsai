/**
 * Pure templating helpers for newsletter personalization.
 *
 * Per-recipient fanout substitutes a small set of tokens into
 * the campaign body before each Resend send:
 *   {{firstName}}      → recipient's first name
 *   {{lastName}}       → recipient's last name
 *   {{fullName}}       → "First Last" or first/last alone
 *   {{email}}          → recipient's email
 *   {{agentName}}      → agent's display name
 *   {{unsubscribeUrl}} → CAN-SPAM compliant unsubscribe link
 *
 * Tokens that don't match an entry in the input map render as
 * an empty string, NOT the literal `{{token}}`. That way a
 * missing first name on one recipient just blanks out gracefully
 * instead of leaking template syntax.
 *
 * Pure — vitest hits substitution + escaping directly.
 */

export type TemplateTokens = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  agentName?: string | null;
  unsubscribeUrl?: string | null;
  /** Free-form extra tokens for callers that want to extend
   *  without changing the type — e.g. {{propertyAddress}}
   *  for a "just listed" campaign. */
  extras?: Record<string, string | null | undefined>;
};

/**
 * Substitute `{{token}}` placeholders in plain text. Use this for
 * `body_text` (the plain-text fallback). HTML callers should use
 * `expandHtmlTemplate` so substituted values get HTML-escaped to
 * prevent injection.
 */
export function expandTextTemplate(template: string, tokens: TemplateTokens): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, name: string) => {
    return resolveToken(name, tokens) ?? "";
  });
}

/**
 * Substitute `{{token}}` placeholders in HTML. Token VALUES are
 * HTML-escaped — a name like `<b>Jane</b>` won't inject markup.
 * The template itself is treated as trusted HTML (the agent
 * authored it).
 */
export function expandHtmlTemplate(template: string, tokens: TemplateTokens): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, name: string) => {
    return escapeHtml(resolveToken(name, tokens) ?? "");
  });
}

function resolveToken(name: string, tokens: TemplateTokens): string | null {
  const lower = name.toLowerCase();
  switch (lower) {
    case "firstname":
      return (tokens.firstName ?? "").trim() || null;
    case "lastname":
      return (tokens.lastName ?? "").trim() || null;
    case "fullname": {
      const f = (tokens.firstName ?? "").trim();
      const l = (tokens.lastName ?? "").trim();
      const joined = [f, l].filter(Boolean).join(" ").trim();
      return joined || null;
    }
    case "email":
      return (tokens.email ?? "").trim() || null;
    case "agentname":
      return (tokens.agentName ?? "").trim() || null;
    case "unsubscribeurl":
      return (tokens.unsubscribeUrl ?? "").trim() || null;
    default: {
      const extra = tokens.extras?.[name];
      if (extra == null) return null;
      const trimmed = String(extra).trim();
      return trimmed || null;
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Find every {{token}} reference in a template — useful for the
 * compose UI to warn ("you used {{phoneNumber}} but that's not
 * a recognized token").
 */
export function extractTokens(template: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([\w]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}
