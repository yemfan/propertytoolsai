"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/lib/auth/roles";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [error, setError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"agent" | "loan_broker" | "support">("agent");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        users?: AdminUser[];
      };

      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to load users");
      }

      setUsers(json.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;

    const q = query.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  async function updateUser(userId: string, payload: Partial<{ role: UserRole; isActive: boolean }>) {
    try {
      setSavingId(userId);
      setError("");

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userId,
          ...payload,
        }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to update user");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: payload.role ?? u.role,
                is_active: payload.isActive ?? u.is_active,
              }
            : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSavingId("");
    }
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();

    try {
      setInviting(true);
      setInviteMessage("");
      setError("");

      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName || undefined,
          role: inviteRole,
        }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to invite user");
      }

      setInviteMessage("Invitation sent successfully.");
      setInviteEmail("");
      setInviteName("");
      setInviteRole("agent");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage roles, invitations, and account access.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="flex-1 rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                />

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                  <option value="loan_broker">Loan Broker</option>
                  <option value="support">Support</option>
                  <option value="consumer">Consumer</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  className="rounded-2xl border px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">User</th>
                    <th className="px-5 py-4 font-medium">Role</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Created</th>
                    <th className="px-5 py-4 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b last:border-b-0">
                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-900">
                            {user.full_name || "Unnamed User"}
                          </div>
                          <div className="text-gray-500">{user.email}</div>
                        </td>

                        <td className="px-5 py-4">
                          <select
                            value={user.role}
                            disabled={savingId === user.id}
                            onChange={(e) =>
                              void updateUser(user.id, {
                                role: e.target.value as UserRole,
                              })
                            }
                            className="rounded-xl border px-3 py-2 text-sm"
                          >
                            <option value="admin">Admin</option>
                            <option value="agent">Agent</option>
                            <option value="loan_broker">Loan Broker</option>
                            <option value="support">Support</option>
                            <option value="consumer">Consumer</option>
                          </select>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={[
                              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                              user.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-700",
                            ].join(" ")}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-gray-500">
                          {formatDate(user.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            disabled={savingId === user.id}
                            onClick={() =>
                              void updateUser(user.id, {
                                isActive: !user.is_active,
                              })
                            }
                            className="rounded-xl border px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Invite User</h2>
            <p className="mt-1 text-sm text-gray-500">
              Invite agents, loan brokers, or support staff.
            </p>

            <form onSubmit={inviteUser} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                  placeholder="User name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "agent" | "loan_broker" | "support")
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                >
                  <option value="agent">Agent</option>
                  <option value="loan_broker">Loan Broker</option>
                  <option value="support">Support</option>
                </select>
              </div>

              {inviteMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {inviteMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={inviting}
                className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300"
              >
                {inviting ? "Sending Invite..." : "Send Invite"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
