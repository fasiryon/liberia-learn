"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LegalFooter } from "@/components/LegalFooter";

type MoeUser = {
  name?: string | null;
  email?: string | null;
};

const NAV_ITEMS = [
  { href: "/moe/dashboard", label: "Dashboard" },
  { href: "/moe/districts", label: "Districts" },
  { href: "/moe/compliance", label: "Compliance" },
  { href: "/moe/alerts", label: "Alerts" },
  { href: "/moe/exports", label: "Exports" },
];

export default function MoeShell({
  user,
  children,
}: {
  user: MoeUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1326]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/moe/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-sm font-black text-slate-950">
              L
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                LiberiaLearn
              </p>
              <p className="text-sm font-medium text-slate-100">
                Ministry of Education Portal
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 transition ${
                    active
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "text-slate-300 hover:text-slate-100 hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
            <div className="rounded-full bg-white/5 px-3 py-1.5">
              <p className="text-slate-200">{user.name || "MOE Official"}</p>
              <p className="text-[10px] text-slate-400">{user.email || "—"}</p>
            </div>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-red-400/40 px-3 py-1.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/20"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {children}
      </main>
      <LegalFooter />
    </div>
  );
}
