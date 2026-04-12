import { AddContactClient } from "./AddContactClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Lead",
  description: "Add a new lead to your pipeline.",
  keywords: ["add lead", "new contact", "CRM"],
  robots: { index: false },
};

export default function AddContactPage() {
  return <AddContactClient />;
}
