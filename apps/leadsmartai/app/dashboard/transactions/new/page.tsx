import type { Metadata } from "next";
import { NewTransactionClient } from "./NewTransactionClient";

export const metadata: Metadata = {
  title: "New transaction",
  robots: { index: false },
};

export default function NewTransactionPage() {
  return <NewTransactionClient />;
}
