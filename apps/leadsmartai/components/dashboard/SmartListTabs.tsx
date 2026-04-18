"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { SmartList } from "@/lib/contacts/types";

type Props = {
  lists: SmartList[];
  activeListId: string | null;
};

/**
 * Horizontal tab bar for Smart Lists. Defaults (Leads/Sphere/All) render
 * first by sort_order. Custom lists after. Hidden lists are omitted from
 * the bar but visible in the "Manage" popover.
 *
 * Active list is driven by ?list=<id> URL param so server components can
 * read it and pre-filter the contact list in the same SSR pass.
 */
export default function SmartListTabs({ lists, activeListId }: Props) {
  const visible = lists.filter((l) => !l.isHidden);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <nav aria-label="Smart lists" className="flex flex-wrap items-center gap-1">
          {visible.map((list) => {
            const isActive = list.id === activeListId;
            return (
              <Link
                key={list.id}
                href={`?list=${encodeURIComponent(list.id)}`}
                scroll={false}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                }`}
                title={list.description ?? undefined}
              >
                {list.name}
                {list.isDefault && (
                  <span
                    className={`ml-1.5 text-[10px] uppercase tracking-wide ${
                      isActive ? "text-white/60" : "text-gray-400"
                    }`}
                  >
                    default
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setManageOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-3 w-3" aria-hidden /> Manage
          </button>
        </div>
      </div>
      {manageOpen && (
        <SmartListManager
          lists={lists}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

function SmartListManager({
  lists,
  onClose,
}: {
  lists: SmartList[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function toggleHidden(list: SmartList) {
    setPendingId(list.id);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/smart-lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !list.isHidden }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(list: SmartList) {
    if (list.isDefault) return;
    setPendingId(list.id);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/smart-lists/${list.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setPendingId(null);
    }
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setPendingId("__new__");
    setError(null);
    try {
      const res = await fetch("/api/dashboard/smart-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          filterConfig: {},
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setNewName("");
      setCreating(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
          Manage Smart Lists
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </div>
      )}
      <ul className="mt-2 space-y-1">
        {lists.map((list) => (
          <li
            key={list.id}
            className="flex items-center justify-between rounded-md bg-white px-3 py-1.5 text-sm shadow-sm"
          >
            <span className="flex items-center gap-2">
              <span className="text-gray-900">{list.name}</span>
              {list.isDefault && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                  default
                </span>
              )}
              {list.isHidden && (
                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                  hidden
                </span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleHidden(list)}
                disabled={pendingId === list.id}
                className="inline-flex h-7 items-center gap-1 rounded border border-gray-200 bg-white px-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {list.isHidden ? "Show" : "Hide"}
              </button>
              {!list.isDefault && (
                <button
                  type="button"
                  onClick={() => remove(list)}
                  disabled={pendingId === list.id}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Delete list"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="List name (e.g. Hot buyers)"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") setCreating(false);
              }}
            />
            <button
              type="button"
              onClick={create}
              disabled={pendingId === "__new__"}
              className="rounded bg-gray-900 px-3 py-1 text-xs text-white disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-white"
          >
            <Plus className="h-3 w-3" /> Add Smart List
          </button>
        )}
        <p className="mt-2 text-[11px] text-gray-500">
          Custom lists start with no filters — open the list and add conditions
          to narrow it down. Advanced filter editing is coming soon; for now,
          the three defaults (Leads, Sphere, All) cover the common cases.
        </p>
      </div>
    </div>
  );
}
