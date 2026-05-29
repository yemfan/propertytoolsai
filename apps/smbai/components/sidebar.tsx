"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Users, Inbox, Phone, Calendar,
  Mic, Share2, Settings, Building2, LogOut, Sparkles, LayoutDashboard,
  CheckSquare, Mail, BarChart2, Zap, Clock, TrendingUp, FolderOpen,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";

const navSections = [
  {
    title: "Workspace",
    items: [
      { key: "home",     label: "Dashboard",   icon: LayoutDashboard, href: "/home" },
      { key: "inbox",    label: "Inbox",       icon: Inbox,           href: "/inbox" },
      { key: "calendar", label: "Calendar",    icon: Calendar,        href: "/calendar" },
      { key: "tasks",    label: "Tasks",       icon: CheckSquare,     href: "/tasks" },
      { key: "ask",      label: "Ask AI",      icon: Sparkles,        href: "/ask" },
    ],
  },
  {
    title: "Reception",
    items: [
      { key: "reception", label: "Reception",   icon: Phone, href: "/reception" },
      { key: "voice",     label: "Voice Agent", icon: Mic,   href: "/voice" },
      { key: "clients",   label: "Clients",     icon: Users, href: "/clients" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { key: "pipeline",  label: "Pipeline",  icon: TrendingUp, href: "/pipeline" },
      { key: "social",    label: "Social",    icon: Share2,     href: "/social" },
      { key: "marketing", label: "Marketing", icon: Mail,       href: "/marketing" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { key: "books",   label: "Books",   icon: BookOpen,  href: "/books" },
      { key: "reports", label: "Reports", icon: BarChart2, href: "/reports" },
    ],
  },
  {
    title: "Managing",
    items: [
      { key: "projects",    label: "Projects",    icon: FolderOpen, href: "/projects" },
      { key: "timesheets",  label: "Timesheets",  icon: Clock,      href: "/timesheets" },
      { key: "automations", label: "Automations", icon: Zap,        href: "/automations" },
      { key: "settings",    label: "Settings",    icon: Settings,   href: "/settings" },
    ],
  },
];

interface Props {
  unreadCount?: number;
  notificationsSlot?: ReactNode;
  userEmail?: string | null;
}

export function Sidebar({ unreadCount = 0, notificationsSlot, userEmail }: Props) {
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {section.title}
            </p>
            {section.items.map(({ key, label, icon: Icon, href }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
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
          </div>
        ))}
      </nav>

      {/* Bottom: user */}
      {userEmail && (
        <div className="px-3 py-3 border-t border-slate-800">
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
        </div>
      )}
    </aside>
  );
}
