import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">About PropertyTools AI</h1>
      <p className="text-slate-600 mb-6">
        PropertyTools AI provides AI-powered real estate tools to help you calculate, analyze, and invest with confidence.
      </p>
      <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">
        ← Back to Home
      </Link>
    </div>
  );
}
