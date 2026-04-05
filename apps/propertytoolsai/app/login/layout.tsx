import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your PropertyTools AI account to access your dashboard and saved tools.",
  keywords: ["login", "sign in", "PropertyTools AI", "account login"],
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
