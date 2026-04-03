import Link from "next/link";
import { ListTodo } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md shadow-slate-900/15">
          <ListTodo className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tasks</h1>
          <p className="mt-1 text-sm text-slate-600">
            Follow-ups and operational tasks across leads. Your home dashboard surfaces today&apos;s items too.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03]">
        <p className="text-sm text-slate-600">
          Task rows are loaded from the same <code className="rounded bg-slate-100 px-1 text-xs">tasks</code> table used
          by briefings and the calendar. Manage statuses via API or upcoming inline editor.
        </p>
        <p className="mt-4">
          <Link href="/dashboard/calendar" className="text-sm font-semibold text-[#0072ce] hover:underline">
            View calendar &amp; overdue →
          </Link>
        </p>
      </div>
    </div>
  );
}
