"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardShellProps = {
  title: string;
  subtitle: string;
  kpis: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardShell({ title, subtitle, kpis, children, className }: DashboardShellProps) {
  return (
    <div className={cn("min-h-screen bg-gray-50 p-4 md:p-6", className)}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">{kpis}</div>

        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
