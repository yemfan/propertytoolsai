import PerformanceClient from "./PerformanceClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Performance",
  description: "Analyze lead conversion rates and agent performance.",
  keywords: ["performance", "analytics", "conversion"],
  robots: { index: false },
};

export default function PerformancePage() {
  return <PerformanceClient />;
}
