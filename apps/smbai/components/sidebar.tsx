"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Users, Inbox, Phone, Calendar,
  Mic, Share2, Settings, Building2, LogOut, Sparkles, LayoutDashboard,
  CheckSquare, Mail, BarChart2, Zap, Clock, TrendingUp,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";

const activeModules = [
  { key: "home",       label: "Dashboard",   icon: LayoutDashboard, href: "/home" },
  { key: "books",      label: "Books",       icon: BookOpen,        href: "/books" },
  { key: "clients",    label: "Clients",     icon: Users,           href: "/clients" },
  { key: "pipeline",   label: "Pipeline",    icon: TrendingUp,      href: "/pipeline" },
  { key: "inbox",      label: "Inbox",       icon: Inbox,           href: "/inbox" },
  { key: "reception",  label: "Reception",   icon: Phone,           href: "/reception" },
  { key: "calendar",   label: "Calendar",    icon: Calendar,        href: "/calendar" },
  { key: "voice",      label: "Voice Agent", icon: Mic,             href: "/voice" },
  { key: "social",     label: "Social",      icon: Share2,          href: "/social" },
  { key: "tasks",       label: "Tasks",       icon: CheckSquare,     href: "/tasks" },
  { key: "timesheets",  label: "Timesheets",  icon: Clock,           href: "/timesheets" },
  { key: "marketing",   label: "Marketing",   icon: Mail,            href: "/marketing" },
  { key: "reports",      label: "Reports",     icon: BarChart2,       href: "/reports" },
  { key: "automations", label: "Automations", icon: Zap,             href: "/automations" },
  { key: "ask",         label: "Ask AI",      icon: Sparkles,        href: "/ask" },
];

interface Props {
  unreadCount?: number;
  notificationsSlot?: ReactNode;
  searchSlot?: ReactNode;
  userEmail?: string | null;
}

export function Sidebar({ unreadCount = 0, notificationsSlot, searchSlot, userEmail }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Logo + notification bell */}
      <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">SMB AI</span>
        </div>
        {notificationsSlot}
      </div>

      {/* Search bar */}
      {searchSlot && (
        <div className="px-3 pt-3 pb-1">
          {searchSlot}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {activeModules.map(({ key, label, icon: Icon, href }) => {
          const active = href === "/books"
            ? pathname === "/books" || pathname.startsWith("/books/")
            : pathname === href || pathname.startsWith(`${href}/`);

          // Show inbox unread badge
          const badge = key === "inbox" && unreadCount > 0 ? unreadCount : 0;

          return (
            <Link
              key={key}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="text-[10px] font-bold bg-indigo-500 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings + user */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-1">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-slate-800 text-slate-100"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Settings
        </Link>

        {/* User row */}
        {userEmail && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {userEmail[0].toUpperCase()}
            </div>
            <span className="flex-1 text-xs text-slate-500 truncate">{userEmail}</span>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                className="p-1 text-slate-600 hover:text-slate-300 transition-colors rounded"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
