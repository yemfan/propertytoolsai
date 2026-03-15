import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Contact</h1>
      <p className="text-slate-600 mb-6">
        Get in touch with the PropertyToolsAI team. We&apos;d love to hear from you.
      </p>
      <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">
        ← Back to Home
      </Link>
    </div>
  );
}
