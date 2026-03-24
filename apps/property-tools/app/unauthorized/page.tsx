import Link from "next/link";

export const metadata = {
  title: "Access denied | PropertyTools AI",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-3xl border bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-lg font-bold text-white">
          !
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900">Access Denied</h1>

        <p className="mt-3 text-base text-gray-500">You do not have permission to view this page.</p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Go to My Dashboard
          </Link>

          <Link
            href="/login"
            className="rounded-2xl border px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
          >
            Log In Again
          </Link>
        </div>
      </div>
    </div>
  );
}
