import InboxClient from "./InboxClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox",
  description: "View and respond to messages from leads and clients.",
  keywords: ["inbox", "messages", "communication"],
  robots: { index: false },
};

export default function InboxPage() {
  return <InboxClient />;
}
