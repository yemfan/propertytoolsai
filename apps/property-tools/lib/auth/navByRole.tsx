import type { NavLeafItem, NavSection } from "@repo/ui";
import { Building2, Headphones, LayoutDashboard, Shield, Users, Wallet } from "lucide-react";
import { propertyToolsNav } from "@/nav.config";
import type { UserRole } from "./roles";

/**
 * Base Property Tools nav plus role-aware shortcuts (RBAC entry points).
 */
export function getNavSectionsForRole(role: UserRole): NavSection[] {
  const items: NavLeafItem[] = [
    {
      label: "Role hub",
      href: "/dashboard",
      match: ["/dashboard", "/dashboard-router"],
      icon: <LayoutDashboard size={16} strokeWidth={2} aria-hidden />,
    },
  ];

  if (role === "admin") {
    items.push({
      label: "Admin",
      href: "/admin/platform-overview",
      match: ["/admin/platform-overview"],
      icon: <Shield size={16} strokeWidth={2} aria-hidden />,
    });
    items.push({
      label: "User management",
      href: "/admin/users",
      match: ["/admin/users"],
      icon: <Users size={16} strokeWidth={2} aria-hidden />,
    });
  }

  if (role === "admin" || role === "support") {
    items.push({
      label: "Support",
      href: "/support/dashboard",
      match: ["/support/dashboard"],
      icon: <Headphones size={16} strokeWidth={2} aria-hidden />,
    });
  }

  if (role === "admin" || role === "agent") {
    items.push({
      label: "Agent workspace",
      href: "/agent/dashboard",
      match: ["/agent/dashboard"],
      icon: <Building2 size={16} strokeWidth={2} aria-hidden />,
    });
  }

  if (role === "admin" || role === "loan_broker") {
    items.push({
      label: "Loan broker",
      href: "/loan-broker/dashboard",
      match: ["/loan-broker/dashboard"],
      icon: <Wallet size={16} strokeWidth={2} aria-hidden />,
    });
  }

  if (role === "consumer") {
    items.push({
      label: "My dashboard",
      href: "/propertytools/dashboard",
      match: ["/propertytools/dashboard"],
      icon: <LayoutDashboard size={16} strokeWidth={2} aria-hidden />,
    });
  }

  const workspace: NavSection = {
    label: "Workspace",
    defaultOpen: false,
    icon: <LayoutDashboard size={18} strokeWidth={2} aria-hidden />,
    items,
  };

  return [workspace, ...propertyToolsNav];
}
