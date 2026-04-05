import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Down Payment Calculator",
  description: "Calculate required down payment for home purchases. Determine deposit amount, loan size, and PMI with our down payment calculator.",
  keywords: ["down payment calculator", "home purchase", "loan amount", "PMI", "mortgage"],
};

export default function DownPaymentCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
