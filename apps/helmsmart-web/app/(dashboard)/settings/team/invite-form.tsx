"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { inviteMember } from "@/lib/actions/team";

type Role = "admin" | "bookkeeper" | "viewer";

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "admin",      label: "Admin",       desc: "Full access, can manage members" },
  { value: "bookkeeper", label: "Bookkeeper",  desc: "Access to Books and Reports" },
  { value: "viewer",     label: "Viewer",      desc: "Read-only access" },
];

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole]   = useState<Role>("viewer");
  const [error, setError] = useState("");
  const [done, setDone]   = useState(false);
  const [pending, start]  = useTransition();

  function handleSubmit() {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setDone(false);
    start(async () => {
      try {
        await inviteMember(email.trim().toLowerCase(), role);
        setEmail("");
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-800 mb-4">Invite a team member</h2>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setDone(false); }}
            placeholder="colleague@example.com"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Send className="w-4 h-4" />
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-600 bg-rose-50 rounded-lg px-4 py-2">{error}</p>
      )}
      {done && (
        <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-4 py-2">
          Invitation sent to <strong>{email || "them"}</strong>. They have 7 days to accept.
        </p>
      )}
    </div>
  );
}
