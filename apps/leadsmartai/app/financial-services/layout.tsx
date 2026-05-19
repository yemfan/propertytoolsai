import { ReactNode } from "react";

/**
 * Financial-services vertical (IMO / MLM financial services agencies).
 * Demo target: GFI (Global Financial Impact). Sellable to WFG, PFO, and similar
 * Transamerica/AEGON-affiliated agencies post-pilot.
 *
 * Parent layout is intentionally a pass-through so:
 *  - `/financial-services` and `/financial-services/pricing` stay public marketing.
 *  - `/financial-services/dashboard/*` enforces auth via its own nested layout.
 */
export default function FinancialServicesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
