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
  { href: "/moe/submissions", label: "School Submissions" },
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
    <div className="min-h-screen bg-[#0b1120] text-[var(--ll-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--ll-border)] bg-[#0a1326]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/moe/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ll-yellow-soft)] text-sm font-black text-[var(--ll-text-faint)]">
              L
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">
                LiberiaLearn
              </p>
              <p className="text-sm font-medium text-[var(--ll-text)]">
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
                      ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                      : "text-[var(--ll-text)] hover:text-[var(--ll-text)] hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
            <div className="rounded-full bg-white/5 px-3 py-1.5">
              <p className="text-[var(--ll-text)]">{user.name || "MOE Official"}</p>
              <p className="text-[10px] text-[var(--ll-text-muted)]">{user.email || "—"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {children}
      </main>
      <LegalFooter variant="portal" />
    </div>
  );
}
