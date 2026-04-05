import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Free Account",
  description:
    "Sign up for a free PropertyTools AI account and start using our calculators, valuation tools, and investment analysis.",
  keywords: ["sign up", "create account", "free account", "register", "PropertyTools AI"],
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
