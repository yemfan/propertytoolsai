import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Access your personalized home-buying dashboard.",
  keywords: ["client portal", "home buying", "dashboard"],
  robots: { index: false },
};

export default function ClientIndexPage() {
  redirect("/client/dashboard");
}
