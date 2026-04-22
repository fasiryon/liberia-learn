import { notFound, redirect } from "next/navigation";
import { requireMoePortalUser } from "@/lib/moeAccess";
import Link from "next/link";
import { EnvironmentBadge, getEnvironmentBadgeValue } from "@/components/ui/EnvironmentBadge";

const NAV = [
  { href: "/platform", label: "Dashboard" },
  { href: "/platform/ops", label: "Ops" },
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
  let user = null;
  try {
    user = await requireMoePortalUser();
  } catch (err: any) {
    if (err?.status === 404) notFound();
    redirect("/login");
  }

  const navItems =
    user.role === "DISTRICT_ADMIN" ? NAV.slice(0, 1) : NAV;
  const environment = getEnvironmentBadgeValue();

  return (
    <div className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      {/* Top nav */}
      <header className="border-b border-[var(--ll-border)] bg-[var(--ll-bg)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/platform" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-sm font-black text-[var(--ll-text)]">
              P
            </span>
            <span className="text-sm font-semibold text-[var(--ll-text)]">
              Platform Admin
            </span>
          </Link>

          <nav className="flex gap-4">
            {navItems.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto text-xs text-[var(--ll-text-faint)]">
            <div className="flex items-center gap-3">
              <EnvironmentBadge environment={environment} />
              <span>{user.email}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
