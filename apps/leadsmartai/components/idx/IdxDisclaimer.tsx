/**
 * Compliance footer shown on every public IDX surface (SRP, PDP, lead-capture
 * confirmation). Two purposes:
 *   1. Rentcast TOS Section 8.1 mitigation — they disclaim accuracy and
 *      timeliness. We pass that disclaimer through to consumers so we are not
 *      misrepresenting the data.
 *   2. MLS IDX best practice — even though Rentcast does not require MLS
 *      attribution, surfacing a generic "third-party MLS data" line inoculates
 *      us against individual MLS objections during pilot.
 *
 * Wording is intentionally generic so the same component works once we add a
 * direct-IDX-feed adapter alongside Rentcast.
 */
export default function IdxDisclaimer() {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-6 pb-10 text-[11px] leading-relaxed text-slate-500">
      <p>
        Listing data is provided by third-party MLS sources and aggregators and
        may not reflect the most current MLS information. Properties may be
        pending, sold, or withdrawn. Listing prices, photos, and details are
        subject to change without notice. Contact a licensed real estate agent
        to verify availability before relying on this information.
      </p>
      <p className="mt-2">
        Listings displayed for informational purposes only. All measurements,
        square footage, and lot sizes are approximate. Equal Housing Opportunity.
      </p>
    </footer>
  );
}
