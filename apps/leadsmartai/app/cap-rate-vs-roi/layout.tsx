import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cap Rate vs ROI",
  description: "Compare cap rate and ROI for real estate investments. Learn the differences and how each metric applies to property analysis.",
  keywords: ["cap rate", "ROI", "return on investment", "real estate", "property metrics"],
};

export default function CapRateROICompareLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
