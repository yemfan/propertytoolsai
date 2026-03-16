// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Sidebar from "../components/Sidebar";

export const metadata = {
  title: "PropertyToolsAI",
  description: "AI-Powered Real Estate Tools for Smart Property Decisions",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-800">
        <div className="min-h-screen flex">
          {/* @ts-expect-error Sidebar is a client component used in server layout */}
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}

