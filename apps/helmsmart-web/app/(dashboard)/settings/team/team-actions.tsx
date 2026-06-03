"use client";

import { useState, useTransition } from "react";
import { UserMinus, ChevronDown } from "lucide-react";
import {
  updateMemberRole,
  removeMember,
  revokeInvitation,
} from "@/lib/actions/team";

type Role = "admin" | "bookkeeper" | "viewer";

const ROLES: { value: Role; label: string }[] = [
  { value: "admin",      label: "Admin" },
  { value: "bookkeeper", label: "Bookkeeper" },
  { value: "viewer",     label: "Viewer" },
];

// ─── Role selector for an active member ───────────────────────────────────────

export function RoleSelector({
  memberId,
  currentRole,
  disabled,
}: {
  memberId: string;
  currentRole: string;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [role, setRole] = useState(currentRole);

  function handleChange(next: Role) {
    setRole(next);
    start(async () => {
      await updateMemberRole(memberId, next);
    });
  }

  if (disabled) {
    return (
      <span className="text-xs font-medium text-slate-500 capitalize px-2.5 py-1 bg-slate-100 rounded-full">
        {currentRole}
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value as Role)}
        disabled={pending}
        className="text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 pr-6 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 cursor-pointer"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ─── Remove member button ─────────────────────────────────────────────────────

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const [pending, start] = useTransition();

  function handleRemove() {
    if (!window.confirm("Remove this team member? They will lose access immediately.")) return;
    start(async () => {
      await removeMember(memberId);
    });
  }

  return (
    <button
      onClick={handleRemove}
      disabled={pending}
      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
      title="Remove member"
    >
      <UserMinus className="w-4 h-4" />
    </button>
  );
}

// ─── Revoke invitation button ─────────────────────────────────────────────────

export function RevokeInviteButton({ invitationId }: { invitationId: string }) {
  const [pending, start] = useTransition();

  function handleRevoke() {
    if (!window.confirm("Revoke this invitation?")) return;
    start(async () => {
      await revokeInvitation(invitationId);
    });
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={pending}
      className="text-xs text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
