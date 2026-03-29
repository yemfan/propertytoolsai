import Link from "next/link";
import { ReactNode } from "react";

/**
 * Shared layout for tool pages — matches calculator pages (e.g. mortgage, refinance):
 * back link, blue title, gray intro, 2/3 + 1/3 grid with white shadow panels and sticky results.
 */
export default function ToolPageScaffold({
  title,
  subtitle,
  inputTitle = "Inputs",
  inputDescription,
  resultTitle = "Results",
  resultDescription,
  inputContent,
  resultContent,
}: {
  title: string;
  subtitle: string;
  inputTitle?: string;
  inputDescription?: string;
  resultTitle?: string;
  resultDescription?: string;
  inputContent: ReactNode;
  resultContent: ReactNode;
}) {
  return (
    <div className="w-full max-w-6xl py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-blue-600">{title}</h1>
      <p className="mb-8 text-gray-600">{subtitle}</p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="space-y-4 rounded-lg bg-white p-6 shadow-md">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{inputTitle}</h2>
              {inputDescription ? (
                <p className="mt-1 text-sm text-gray-600">{inputDescription}</p>
              ) : null}
            </div>
            {inputContent}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <div className="space-y-4 rounded-lg bg-white p-6 shadow-md">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{resultTitle}</h2>
                {resultDescription ? (
                  <p className="mt-1 text-sm text-gray-600">{resultDescription}</p>
                ) : null}
              </div>
              {resultContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
