import { Suspense } from "react";
import type { Metadata } from "next";
import OnePagerClient from "./OnePagerClient";

export const metadata: Metadata = {
  title: "LeadSmart AI for GFI · Executive Brief",
  description:
    "Purpose-built AI workspace for MLM financial-services agencies. 90-day pilot, no cost, decision framework at day 90.",
  robots: { index: false },
};

export default function OnePagerPage() {
  return (
    <Suspense fallback={<div />}>
      <OnePagerClient />
    </Suspense>
  );
}
