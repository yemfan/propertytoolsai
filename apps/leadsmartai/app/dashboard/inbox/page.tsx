import InboxClient from "./InboxClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversations",
  description: "Unified SMS + email conversations with leads and clients — every sent and received message threaded by contact.",
  keywords: ["conversations", "inbox", "messages", "sms", "email", "communication"],
  robots: { index: false },
};

export default function InboxPage() {
  return <InboxClient />;
}
