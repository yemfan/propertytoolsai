import Link from "next/link";
import { Inbox } from "lucide-react";

export default function InboxPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md shadow-slate-900/15">
          <Inbox className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inbox</h1>
          <p className="mt-1 text-sm text-slate-600">
            Central place for SMS, email, and notifications. Wire your channels here for a unified thread view.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
        <p className="text-sm text-slate-600">
          Conversation threads will appear here as you connect messaging providers.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard/send"
            className="inline-flex rounded-xl bg-[#0072ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005fa3]"
          >
            Open send center
          </Link>
          <Link
            href="/dashboard/notifications"
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Notifications
          </Link>
        </div>
      </div>
    </div>
  );
}
