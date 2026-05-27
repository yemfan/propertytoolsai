import type { Metadata } from "next";
import { AskClient } from "./ask-client";

export const metadata: Metadata = { title: "Ask AI" };

export default function AskPage() {
  return <AskClient />;
}
