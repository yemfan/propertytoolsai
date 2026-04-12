import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loan Broker Dashboard",
  description: "Access your loan broker dashboard and tools.",
  keywords: ["loan broker", "dashboard", "mortgage"],
  robots: { index: false },
};

export default function LoanBrokerDashboardIndex() {
  redirect("/loan-broker/dashboard/overview");
}
