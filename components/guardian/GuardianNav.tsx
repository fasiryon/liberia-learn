"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/guardian/dashboard", label: "Overview" },
  { href: "/guardian/progress", label: "Progress" },
  { href: "/guardian/messages", label: "Messages", badgeKey: "messages" },
  { href: "/guardian/settings", label: "Settings" },
];

export function GuardianNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/guardian/dashboard", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setUnreadCount(typeof data?.unreadMessages === "number" ? data.unreadMessages : 0);
      })
      .catch(() => {
        if (active) setUnreadCount(0);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
      {LINKS.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/guardian/dashboard" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              active
                ? "bg-emerald-400 text-slate-950"
                : "border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-500"
            }`}
          >
            <span>{link.label}</span>
            {link.badgeKey === "messages" && unreadCount > 0 ? (
              <span className="rounded-full bg-slate-950/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
