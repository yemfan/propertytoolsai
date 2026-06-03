import type { Metadata } from "next";
import Link from "next/link";
import SalesFormComponent from "../_components/sales-form";

export const metadata: Metadata = {
  title: "Get a Demo — HelmSmart",
  description: "Schedule a personalized demo of HelmSmart for your business.",
};

export default function SalesPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Let&apos;s find the right plan for your business
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Tell us about your needs and we&apos;ll show you how HelmSmart can save you time and money.
          </p>
        </div>
      </section>

      {/* Sales Form */}
      <section className="mx-auto max-w-2xl px-6 py-20">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <SalesFormComponent />
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3 text-center">
          <div>
            <p className="text-3xl font-bold text-indigo-600">14 days</p>
            <p className="mt-2 text-sm text-gray-600">Free trial, no card needed</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-indigo-600">24h</p>
            <p className="mt-2 text-sm text-gray-600">Response time guarantee</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-indigo-600">30 days</p>
            <p className="mt-2 text-sm text-gray-600">Money-back guarantee</p>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-gray-500">
          Not ready to chat?{" "}
          <Link href="/pricing" className="font-medium text-indigo-600 hover:text-indigo-700">
            Check out our pricing
          </Link>
          {" "}or start with a{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-700">
            free trial
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
