"use client";

import { useState, useTransition } from "react";
import {
  createTeam,
  inviteMember,
  removeMember,
  revokeInvite,
} from "@/app/dashboard/team/actions";
import type { TeamInvite, TeamMembership, TeamRoster } from "@/lib/teams/types";

/**
 * Team management surface.
 *
 * Two states:
 *   - No team yet → "Create team" form
 *   - Team exists → roster + invite form (owner) or read-only roster (member)
 *
 * Invite flow is intentionally manual for MVP: the server returns
 * the raw token; the UI shows the accept link for the owner to
 * copy/share. Email-send for invites layers in a follow-up PR.
 */
export function TeamDashboard({
  currentAgentId,
  isOwner,
  roster,
}: {
  currentAgentId: string;
  isOwner: boolean;
  roster: TeamRoster | null;
}) {
  if (!roster) return <CreateTeamCard />;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Team
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {roster.team.name}
          </h1>
        </div>
        {isOwner ? (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200">
            Owner
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            Member
          </span>
        )}
      </header>

      <RosterCard
        teamId={roster.team.id}
        currentAgentId={currentAgentId}
        isOwner={isOwner}
        members={roster.members}
      />

      {isOwner ? (
        <InviteCard teamId={roster.team.id} pendingInvites={roster.pendingInvites} />
      ) : null}
    </div>
  );
}

// ── Create team ──────────────────────────────────────────────────

function CreateTeamCard() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 ring-1 ring-slate-900/[0.04] shadow-sm">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Create your team</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Bring agents together under one roof. As the owner, you&apos;ll see
          their pipelines, leads, and performance alongside your own. Members
          continue to operate normally.
        </p>
      </header>
      <form
        className="mt-5 flex flex-wrap items-center gap-3"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const r = await createTeam(formData);
            if (!r.ok) setError(r.error);
          });
        }}
      >
        <input
          type="text"
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Bay Area Brokerage"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create team"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

// ── Roster ───────────────────────────────────────────────────────

function RosterCard({
  teamId,
  currentAgentId,
  isOwner,
  members,
}: {
  teamId: string;
  currentAgentId: string;
  isOwner: boolean;
  members: TeamMembership[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 ring-1 ring-slate-900/[0.04] shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Members <span className="text-slate-400">· {members.length}</span>
      </h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.agentId} className="flex items-center gap-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {m.role === "owner" ? "★" : "●"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                Agent {shortenId(m.agentId)}
                {m.agentId === currentAgentId ? (
                  <span className="ml-2 text-xs text-slate-500">(you)</span>
                ) : null}
              </p>
              <p className="text-xs text-slate-500 capitalize">{m.role}</p>
            </div>
            {isOwner && m.role !== "owner" ? (
              <RemoveMemberButton teamId={teamId} agentId={m.agentId} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RemoveMemberButton({ teamId, agentId }: { teamId: string; agentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await removeMember(fd);
        });
      }}
    >
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="agentId" value={agentId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
      >
        Remove
      </button>
    </form>
  );
}

// ── Invites ──────────────────────────────────────────────────────

function InviteCard({
  teamId,
  pendingInvites,
}: {
  teamId: string;
  pendingInvites: TeamInvite[];
}) {
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    rawToken: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 ring-1 ring-slate-900/[0.04] shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Invite a member</h2>
      <p className="mt-1 text-sm text-slate-600">
        Send the generated link to the agent you&apos;d like to invite. They
        sign in with the same email and accept the invitation.
      </p>
      <form
        className="mt-4 flex flex-wrap items-center gap-3"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const r = await inviteMember(formData);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            const email = String(formData.get("email") ?? "");
            setLastInvite({ email, rawToken: r.rawToken });
            (document.getElementById("invite-email-input") as HTMLInputElement | null)?.value &&
              ((document.getElementById("invite-email-input") as HTMLInputElement).value = "");
          });
        }}
      >
        <input type="hidden" name="teamId" value={teamId} />
        <input
          id="invite-email-input"
          type="email"
          name="email"
          required
          placeholder="agent@example.com"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Generate invite link"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {lastInvite ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-800">
            Invite for {lastInvite.email} ready
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Copy this link and send it directly. It expires in 14 days.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1.5 text-[11px] text-emerald-900 ring-1 ring-emerald-200">
            {acceptUrl(lastInvite.rawToken)}
          </code>
        </div>
      ) : null}

      {pendingInvites.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pending invites
          </h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{inv.invitedEmail}</p>
                  <p className="text-xs text-slate-500">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <RevokeInviteButton teamId={teamId} inviteId={inv.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function RevokeInviteButton({ teamId, inviteId }: { teamId: string; inviteId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await revokeInvite(fd);
        });
      }}
    >
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
      >
        Revoke
      </button>
    </form>
  );
}

// ── helpers ──────────────────────────────────────────────────────

function shortenId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function acceptUrl(token: string): string {
  if (typeof window === "undefined") return `/team/accept/${token}`;
  return `${window.location.origin}/team/accept/${token}`;
}
