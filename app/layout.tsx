import "./globals.css";
import { ReactNode } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Sidebar from "../components/Sidebar";
import FloatingCTA from "../components/FloatingCTA";

export const metadata = {
  title: "PropertyToolsAI",
  description: "Professional real estate calculators for buyers, investors, and agents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-800">

        <div className="flex min-h-screen">

          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <div className="flex-1 flex flex-col">

            {/* Header */}
            <Header />

            {/* Page Content */}
            <main className="flex-1 p-8">
              {children}
            </main>

            {/* Footer */}
            <Footer />

          </div>

        </div>

        <FloatingCTA />

      </body>
    </html>
  );
}
