import type { Metadata } from "next";
import { listInvoices } from "@/lib/books/invoices";
import BooksClient from "@/components/dashboard/BooksClient";

export const metadata: Metadata = {
  title: "Books",
  description: "Create and track client invoices — what you've billed and what's been paid.",
  robots: { index: false },
};

/**
 * Books — simple client invoicing for the realtor. Server component fetches the
 * agent's invoices; the client component handles the create form + status actions.
 */
export default async function BooksPage() {
  const invoices = await listInvoices(200);
  return <BooksClient initialInvoices={invoices} />;
}
