import type { Metadata } from "next";
import FinancialServicesDashboardClient from "../FinancialServicesDashboardClient";

export const metadata: Metadata = {
  title: "Financial Services · Overview",
  robots: { index: false },
};

export default function FinancialServicesOverviewPage() {
  return <FinancialServicesDashboardClient />;
}
