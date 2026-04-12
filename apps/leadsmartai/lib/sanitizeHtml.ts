import DOMPurify from "dompurify";

/**
 * Sanitize user-supplied HTML to prevent stored XSS.
 *
 * Uses DOMPurify with a restrictive default config:
 * - Only allows basic formatting tags (p, br, b, strong, em, i,
 *   u, a, span, div, ul, ol, li, h1-h6, img, table, tr, td, th,
 *   thead, tbody) plus safe attributes (href, src, alt, style,
 *   class, target, rel).
 * - Strips `<script>`, `<iframe>`, `<object>`, `<embed>`,
 *   `<form>`, event handlers (onclick, onerror, etc.), and
 *   `javascript:` URIs.
 * - `ADD_ATTR: ["target"]` allows `target="_blank"` on links
 *   (common in email signatures).
 *
 * Used by `BrandingSettingsPanel` to sanitize
 * `branding.signatureHtml` before rendering via
 * `dangerouslySetInnerHTML`. Without this, a user could inject
 * `<script>` or `onerror` handlers into their email signature
 * HTML and execute arbitrary JavaScript in any other user's
 * browser session that renders the preview.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "b", "strong", "em", "i", "u", "s", "a",
      "span", "div", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "img", "table", "tr", "td", "th", "thead", "tbody",
      "blockquote", "pre", "code", "hr",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "style", "class", "target", "rel",
      "width", "height", "align", "valign", "border",
      "cellpadding", "cellspacing", "colspan", "rowspan",
    ],
    ADD_ATTR: ["target"],
    // Force all links to use rel="noopener noreferrer" when
    // target="_blank" is present (prevents reverse tabnabbing).
    ALLOW_DATA_ATTR: false,
  });
}
