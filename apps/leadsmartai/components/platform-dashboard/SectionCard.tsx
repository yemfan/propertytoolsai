import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  /** e.g. grid column spans: `xl:col-span-8` */
  className?: string;
};

export function SectionCard({ title, action, children, className }: SectionCardProps) {
  return (
    <section className={cn("rounded-2xl border border-gray-200/90 bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
