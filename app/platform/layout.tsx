import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Link from "next/link";

const NAV = [
  { href: "/platform", label: "Dashboard" },
  { href: "/platform/schools", label: "Schools" },
  { href: "/platform/audit", label: "Audit Log" },
  { href: "/platform/reports", label: "Reports" },
  { href: "/platform/security", label: "Security" },
  { href: "/platform/demo", label: "Demo" },
];

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser().catch(() => null);
  if (!user || !user.isPlatformAdmin) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top nav */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/platform" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-sm font-black text-white">
              P
            </span>
            <span className="text-sm font-semibold text-slate-200">
              Platform Admin
            </span>
          </Link>

          <nav className="flex gap-4">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto text-xs text-slate-500">
            {user.email}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

