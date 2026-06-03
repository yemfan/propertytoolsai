"use client";

import { useActionState } from "react";
import { updateClient } from "@/lib/actions/clients";
import type { ClientState } from "@/lib/actions/clients";

const STATUS_OPTIONS = [
  { value: "lead",     label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "active",   label: "Active Client" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

interface Props {
  clientId: string;
  initialValues: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone: string;
    status: string;
    source: string;
    notes: string;
    tags: string;
  };
}

export function ClientEditForm({ clientId, initialValues }: Props) {
  const [state, action, isPending] = useActionState<ClientState, FormData>(
    updateClient,
    null
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="client_id" value={clientId} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">First name</label>
          <input
            name="first_name"
            type="text"
            defaultValue={initialValues.first_name}
            disabled={isPending}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Last name</label>
          <input
            name="last_name"
            type="text"
            defaultValue={initialValues.last_name}
            disabled={isPending}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">Company</label>
        <input
          name="company"
          type="text"
          defaultValue={initialValues.company}
          disabled={isPending}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">Email</label>
        <input
          name="email"
          type="email"
          defaultValue={initialValues.email}
          disabled={isPending}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">Phone</label>
        <input
          name="phone"
          type="tel"
          defaultValue={initialValues.phone}
          disabled={isPending}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
          <select
            name="status"
            defaultValue={initialValues.status}
            disabled={isPending}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Source</label>
          <input
            name="source"
            type="text"
            defaultValue={initialValues.source}
            disabled={isPending}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
            placeholder="Referral, website…"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">Tags (comma-separated)</label>
        <input
          name="tags"
          type="text"
          defaultValue={initialValues.tags}
          disabled={isPending}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
          placeholder="vip, contractor…"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initialValues.notes}
          disabled={isPending}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 resize-none"
          placeholder="Any context about this client…"
        />
      </div>

      {state?.error && (
        <p className="text-xs text-rose-600 bg-rose-50 rounded px-2.5 py-1.5">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2.5 py-1.5">Saved!</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
