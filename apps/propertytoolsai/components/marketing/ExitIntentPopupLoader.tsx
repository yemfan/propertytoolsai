"use client";

import dynamic from "next/dynamic";

const ExitIntentPopup = dynamic(
  () => import("@/components/marketing/ExitIntentPopup"),
  { ssr: false }
);

export function ExitIntentPopupLoader() {
  return <ExitIntentPopup />;
}
