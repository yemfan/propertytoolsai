/**
 * Email signature composer — pure.
 *
 * Given an agent's profile + branding, produces:
 *   - html: signature block suitable for appending to a Gmail/Apple
 *           Mail message. Inline styles only, no external CSS. Images
 *           use absolute URLs (Resend/Gmail fetch them directly).
 *   - text: plain-text variant for the multipart/alternative text body.
 *
 * Zero runtime deps → safe to import from client components (preview
 * panel uses the same rendering as the send pipeline). Tests live in
 * __tests__/compose.test.ts.
 */

export type AgentSignatureProfile = {
  firstName: string | null;
  lastName: string | null;
  fullName?: string | null;
  email: string | null;
  phone: string | null;
  brandName: string | null;
  brokerage?: string | null;
  /** Custom HTML signature — overrides the composed default when set. */
  signatureHtml: string | null;
  /** Agent headshot (circular). Separate from brokerage logo. */
  agentPhotoUrl: string | null;
  /** Brokerage logo (rectangular). */
  logoUrl: string | null;
};

export type ComposedSignature = {
  html: string;
  text: string;
  /** True when the output came from a custom signatureHtml override. */
  isCustom: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fullNameFrom(profile: AgentSignatureProfile): string {
  if (profile.fullName && profile.fullName.trim()) return profile.fullName.trim();
  const first = (profile.firstName ?? "").trim();
  const last = (profile.lastName ?? "").trim();
  const combined = [first, last].filter(Boolean).join(" ");
  return combined || (profile.email ?? "").split("@")[0] || "Your agent";
}

function formatPhoneTel(phone: string): string {
  // Keep +, digits only for tel: href; leave display formatting to raw string.
  return phone.replace(/[^\d+]/g, "");
}

/**
 * Compose a signature. If the agent has a custom signatureHtml set,
 * that's returned as-is (with a plain-text fallback auto-derived).
 * Otherwise the default template renders their profile + branding.
 */
export function composeSignature(profile: AgentSignatureProfile): ComposedSignature {
  if (profile.signatureHtml && profile.signatureHtml.trim()) {
    return {
      html: profile.signatureHtml,
      text: htmlToText(profile.signatureHtml),
      isCustom: true,
    };
  }

  return {
    html: defaultSignatureHtml(profile),
    text: defaultSignatureText(profile),
    isCustom: false,
  };
}

/**
 * Default signature HTML. Two-column layout:
 *   left  — optional circular headshot
 *   right — name, brand/brokerage, email, phone, optional brokerage logo
 */
export function defaultSignatureHtml(profile: AgentSignatureProfile): string {
  const name = escapeHtml(fullNameFrom(profile));
  const brand = escapeHtml((profile.brandName ?? profile.brokerage ?? "").trim());
  const email = profile.email ? escapeHtml(profile.email) : null;
  const phone = profile.phone ? escapeHtml(profile.phone) : null;
  const photo = profile.agentPhotoUrl ? escapeHtml(profile.agentPhotoUrl) : null;
  const logo = profile.logoUrl ? escapeHtml(profile.logoUrl) : null;

  const photoCell = photo
    ? `<td width="80" style="padding-right:14px;vertical-align:top;">
         <img src="${photo}" width="72" height="72" alt="" style="display:block;border-radius:50%;object-fit:cover;"/>
       </td>`
    : "";

  const contactLines: string[] = [];
  if (email) {
    contactLines.push(
      `<a href="mailto:${email}" style="color:#0066b3;text-decoration:none;">${email}</a>`,
    );
  }
  if (phone) {
    contactLines.push(
      `<a href="tel:${formatPhoneTel(profile.phone ?? "")}" style="color:#475569;text-decoration:none;">${phone}</a>`,
    );
  }
  const contactHtml = contactLines.length > 0
    ? `<div style="font-size:13px;color:#475569;margin-top:4px;">${contactLines.join(" &nbsp;·&nbsp; ")}</div>`
    : "";

  const logoHtml = logo
    ? `<div style="margin-top:10px;"><img src="${logo}" alt="" style="max-width:140px;max-height:48px;display:block;"/></div>`
    : "";

  return `
<table cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:14px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    ${photoCell}
    <td style="vertical-align:top;">
      <div style="font-size:15px;font-weight:600;color:#0f172a;">${name}</div>
      ${brand ? `<div style="font-size:13px;color:#64748b;margin-top:2px;">${brand}</div>` : ""}
      ${contactHtml}
      ${logoHtml}
    </td>
  </tr>
</table>`.trim();
}

export function defaultSignatureText(profile: AgentSignatureProfile): string {
  const name = fullNameFrom(profile);
  const brand = (profile.brandName ?? profile.brokerage ?? "").trim();
  const parts: string[] = [];
  parts.push("-- ");
  parts.push(name);
  if (brand) parts.push(brand);
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (contactParts.length > 0) parts.push(contactParts.join(" · "));
  return parts.join("\n");
}

/**
 * Minimal HTML → text fallback. Preserves line breaks for common block
 * elements, strips tags, decodes core entities. Not a full parser —
 * good enough for signatures, which are small and controlled.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Append a composed signature to an outbound email body. Called by
 * every send path (drafts/sender, listing alert digest, agent-curated
 * recommendations). The caller passes in the composed signature so
 * the DB fetch happens once per send, not per call-site.
 *
 * Accepts either an HTML body (appends the signature table) or a
 * plain-text body (appends the text variant).
 */
export type AppendOpts = {
  /** Skip the signature entirely (per-send override). */
  skip?: boolean;
};

export function appendHtmlSignature(
  bodyHtml: string,
  sig: ComposedSignature,
  opts: AppendOpts = {},
): string {
  if (opts.skip) return bodyHtml;
  // Place the signature before </body> when possible so it renders
  // inside the email's styled wrapper; otherwise append verbatim.
  if (/<\/body>/i.test(bodyHtml)) {
    return bodyHtml.replace(/<\/body>/i, `${sig.html}</body>`);
  }
  return `${bodyHtml}\n${sig.html}`;
}

export function appendTextSignature(
  bodyText: string,
  sig: ComposedSignature,
  opts: AppendOpts = {},
): string {
  if (opts.skip) return bodyText;
  return `${bodyText}\n\n${sig.text}`;
}
