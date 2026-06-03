"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Users, Inbox, Phone, Calendar,
  Mic, Share2, Settings, LogOut, Sparkles, LayoutDashboard,
  CheckSquare, Mail, BarChart2, Zap, Clock, TrendingUp, FolderOpen, Bot,
} from "lucide-react";
import { Sidebar as HelmUiSidebar, type NavSection } from "@helm/ui";
import { signOut } from "@/lib/actions/auth";

const ICON = 16;

/**
 * Real HelmSmart dashboard routes, grouped. This is the live navigation —
 * presentation (dark shell, brand-blue active state, AI badge) comes from
 * @helm/ui's <Sidebar>; the routes + plumbing stay owned by the app.
 */
const navSections: { title: string; items: { label: string; href: string; icon: ReactNode }[] }[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard",      href: "/home",           icon: <LayoutDashboard size={ICON} /> },
      { label: "Command Center", href: "/command-center", icon: <Bot size={ICON} /> },
      { label: "Inbox",          href: "/inbox",          icon: <Inbox size={ICON} /> },
      { label: "Calendar",       href: "/calendar",       icon: <Calendar size={ICON} /> },
      { label: "Tasks",          href: "/tasks",          icon: <CheckSquare size={ICON} /> },
      { label: "Ask AI",         href: "/ask",            icon: <Sparkles size={ICON} /> },
    ],
  },
  {
    title: "Reception",
    items: [
      { label: "Reception",   href: "/reception", icon: <Phone size={ICON} /> },
      { label: "Voice Agent", href: "/voice",     icon: <Mic size={ICON} /> },
      { label: "Clients",     href: "/clients",   icon: <Users size={ICON} /> },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Pipeline",  href: "/pipeline",  icon: <TrendingUp size={ICON} /> },
      { label: "Social",    href: "/social",    icon: <Share2 size={ICON} /> },
      { label: "Marketing", href: "/marketing", icon: <Mail size={ICON} /> },
    ],
  },
  {
    title: "Accounting",
    items: [
      { label: "Books",   href: "/books",   icon: <BookOpen size={ICON} /> },
      { label: "Reports", href: "/reports", icon: <BarChart2 size={ICON} /> },
    ],
  },
  {
    title: "Managing",
    items: [
      { label: "Projects",    href: "/projects",    icon: <FolderOpen size={ICON} /> },
      { label: "Timesheets",  href: "/timesheets",  icon: <Clock size={ICON} /> },
      { label: "Automations", href: "/automations", icon: <Zap size={ICON} /> },
      { label: "Settings",    href: "/settings",    icon: <Settings size={ICON} /> },
    ],
  },
];

const ALL_HREFS = navSections.flatMap((s) => s.items.map((i) => i.href));

interface Props {
  unreadCount?: number;
  notificationsSlot?: ReactNode;
  userEmail?: string | null;
}

export function Sidebar({ unreadCount = 0, notificationsSlot, userEmail }: Props) {
  const pathname = usePathname();

  // Longest-prefix match so e.g. /books/invoices keeps "Books" highlighted.
  const activeHref = ALL_HREFS
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  const sections: NavSection[] = navSections.map((section) => ({
    label: section.title,
    items: section.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      badge: item.href === "/inbox" && unreadCount > 0 ? unreadCount : undefined,
    })),
  }));

  return (
    <HelmUiSidebar
      productName="HelmSmart"
      logoLetter="H"
      sections={sections}
      activeHref={activeHref}
      linkComponent={Link}
      notificationsSlot={notificationsSlot}
      aiEmployee={{ name: "Mark, AI COO", status: "active" }}
      footer={userEmail ? <UserFooter userEmail={userEmail} /> : undefined}
    />
  );
}

function UserFooter({ userEmail }: { userEmail: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--brand)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {userEmail[0]?.toUpperCase()}
      </div>
      <span
        style={{
          flex: 1,
          fontSize: 11,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Inter, system-ui, sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {userEmail}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          title="Sign out"
          aria-label="Sign out"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.4)",
            display: "flex",
            padding: 2,
          }}
        >
          <LogOut size={14} />
        </button>
      </form>
    </div>
  );
}
