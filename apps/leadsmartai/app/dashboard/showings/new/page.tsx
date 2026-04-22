import type { Metadata } from "next";
import { NewShowingClient } from "./NewShowingClient";

export const metadata: Metadata = {
  title: "Schedule Showing",
  robots: { index: false },
};

export default function NewShowingPage() {
  return <NewShowingClient />;
}
