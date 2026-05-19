import { Suspense } from "react";
import type { Metadata } from "next";
import CarrierIntegrationClient from "./CarrierIntegrationClient";

export const metadata: Metadata = {
  title: "Carrier Integration · LeadSmart AI for Financial Services",
  description:
    "The structured answer for 'can you integrate with WinFlex / iGo / FireLight / TransACT?' — three-phase plan, non-technical hurdles, and the GFI-specific Transamerica shortcut.",
  robots: { index: false },
};

export default function CarrierIntegrationPage() {
  return (
    <Suspense fallback={<div />}>
      <CarrierIntegrationClient />
    </Suspense>
  );
}
