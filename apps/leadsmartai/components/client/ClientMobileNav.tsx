"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/client/dashboard", label: "Home", icon: "⌂" },
  { href: "/client/activity", label: "Activity", icon: "📈" },
  { href: "/client/explore", label: "Homes", icon: "♡" },
  { href: "/client/tracker", label: "Deal", icon: "▤" },
  { href: "/client/documents", label: "Docs", icon: "📄" },
  { href: "/client/chat", label: "Chat", icon: "💬" },
] as const;

export default function ClientMobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md safe-area-pb">
      <div className="max-w-lg mx-auto flex justify-around items-stretch px-1 pt-1 pb-2">
        {tabs.map((t) => {
          const active = path === t.href || path.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 py-1 rounded-lg text-[10px] font-semibold ${
                active ? "text-blue-700 bg-blue-50" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="text-lg leading-none mb-0.5" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
