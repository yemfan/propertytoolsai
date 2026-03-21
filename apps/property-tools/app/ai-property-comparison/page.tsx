import { Suspense } from "react";
import PropertyComparisonClient from "@/components/property-comparison/PropertyComparisonClient";

export const metadata = {
  title: "AI Property Comparison | PropertyTools AI",
  description:
    "Compare multiple investment properties side-by-side with scores and AI-powered recommendations.",
};

export default function AiPropertyComparisonPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
          Loading comparison…
        </div>
      }
    >
      <PropertyComparisonClient />
    </Suspense>
  );
}
