import type { Metadata } from "next";
import { NewOpenHouseClient } from "./NewOpenHouseClient";

export const metadata: Metadata = {
  title: "Schedule Open House",
  robots: { index: false },
};

export default function NewOpenHousePage() {
  return <NewOpenHouseClient />;
}
